import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CRON_SECRET = 'W8ysOgBnzx3MEcUgmegn1Vik4rtNohp'

serve(async (req) => {
  // Security check
  const authHeader = req.headers.get('Authorization') || ''
  const validSecrets = [CRON_SECRET, 'W8ysOgBnzx3MEcUgmegn1Vik4rtNohp']
  const isValid = validSecrets.some(s => authHeader === `Bearer ${s}`)

  if (!isValid) {
    console.error('Unauthorized access attempt')
    return new Response('Unauthorized', { status: 401 })
  }

  // Allow triggering for a specific tenant if provided in body
  let targetTenantId: string | null = null
  try {
    const body = await req.json()
    targetTenantId = body.tenantId || null
  } catch (e) {
    // Ignore error if body is empty
  }

  console.log('Starting notify-expiring function...', { targetTenantId })

  // Read Global Settings
  const { data: globalSettings } = await supabase
    .from('global_settings')
    .select('id, value')
    .in('id', ['evolution_api_url', 'evolution_api_key', 'app_url'])

  const settingsMap = Object.fromEntries((globalSettings || []).map((s: any) => [s.id, s.value]))
  const evolutionUrl = settingsMap['evolution_api_url'] || ''
  const evolutionKey = settingsMap['evolution_api_key'] || ''
  const appUrl = settingsMap['app_url'] || 'https://zapcobranca.com.br'

  if (!evolutionUrl || !evolutionKey) {
    console.error('Evolution API not configured in global settings')
    return new Response('Evolution API not configured', { status: 500 })
  }

  const today = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(today);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value;
  
  const year = parseInt(getPart('year') || '0');
  const month = parseInt(getPart('month') || '0') - 1;
  const day = parseInt(getPart('day') || '0');
  
  const todayBR = new Date(year, month, day, 0, 0, 0, 0);
  console.log('Current Date (BR):', todayBR.toISOString().split('T')[0]);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Fetch tenants
  let query = supabase
    .from('tenants')
    .select(`
      id, company_name, whatsapp,
      notification_config,
      whatsapp_sessions (
        instance_name, status
      )
    `)
    .eq('active', true)
  
  if (targetTenantId) {
    query = query.eq('id', targetTenantId)
  }

  const { data: tenants, error: tenantsError } = await query

  if (tenantsError) {
    console.error('Error fetching tenants:', tenantsError)
    return new Response(JSON.stringify({ error: tenantsError.message }), { status: 500 })
  }

  console.log(`Processing ${tenants?.length || 0} tenants`)

  const globalResults = {
    tenants_processed: 0,
    notifications_queued: 0,
    tenants_skipped: 0,
  }

  for (const tenant of tenants || []) {
    const config = tenant.notification_config || {}
    const session = Array.isArray(tenant.whatsapp_sessions)
      ? tenant.whatsapp_sessions[0]
      : tenant.whatsapp_sessions

    console.log(`Tenant ${tenant.id}: Config enabled=${config.enabled}, WhatsApp status=${session?.status}`)

    if (config.enabled === false) {
      console.log(`Tenant ${tenant.id}: Notifications disabled, skipping`)
      globalResults.tenants_skipped++
      continue
    }

    if (!session?.instance_name || session.status !== 'connected') {
      console.log(`Tenant ${tenant.id}: WhatsApp not connected, skipping`)
      globalResults.tenants_skipped++
      continue
    }

    const beforeDays: number[] = config.before_expiration || [3, 1, 0]
    const afterDays: number[] = config.after_expiration || [1, 3, 7]

    const beforeDates = beforeDays.map(d => {
      const date = new Date(todayBR)
      date.setDate(todayBR.getDate() + d)
      return { days: d, dateStr: toDateStr(date), type: `D-${d}` }
    })

    const afterDates = afterDays.map(d => {
      const date = new Date(todayBR)
      date.setDate(todayBR.getDate() - d)
      return { days: d, dateStr: toDateStr(date), type: `overdue_${d}` }
    })

    const allTargetDates = [...beforeDates, ...afterDates]
    const allDateStrings = allTargetDates.map(t => t.dateStr)

    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select(`
        id, name, username, whatsapp,
        expiration_date, monthly_value,
        payment_token, status
      `)
      .eq('tenant_id', tenant.id)
      .in('expiration_date', allDateStrings)
      .not('whatsapp', 'is', null)
      .neq('status', 'cancelled')

    if (customersError) {
      console.error(`Tenant ${tenant.id}: Error fetching customers:`, customersError)
      continue
    }

    for (const customer of customers || []) {
      const target = allTargetDates.find(t => t.dateStr === customer.expiration_date)
      if (!target) continue

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('type', target.type)
        .gte('sent_at', toDateStr(todayBR) + 'T00:00:00Z')
        .maybeSingle()

      if (existing) continue

      const { data: inQueue } = await supabase
        .from('notification_queue')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('type', target.type)
        .eq('status', 'pending')
        .maybeSingle()

      if (inQueue) continue

      const message = buildMessage(
        config.templates?.[
          target.type === 'D-0' ? 'd0' :
          target.type === 'D-1' ? 'd1' :
          target.type === 'D-3' ? 'd3' :
          target.type
        ] || getDefaultTemplate(target.type),
        customer,
        tenant,
        appUrl
      )

      await supabase
        .from('notification_queue')
        .insert({
          tenant_id: tenant.id,
          customer_id: customer.id,
          type: target.type,
          message,
          whatsapp_number: formatNumber(customer.whatsapp),
          status: 'pending',
          max_attempts: 3,
          next_attempt_at: new Date().toISOString(),
        })

      globalResults.notifications_queued++
    }
    globalResults.tenants_processed++
  }

  console.log('Finished building queue. Starting processQueue...')
  await processQueue(evolutionUrl, evolutionKey, appUrl)

  return new Response(JSON.stringify(globalResults), { status: 200 })
})

async function processQueue(evolutionUrl: string, evolutionKey: string, appUrl: string) {
  const now = new Date().toISOString()
  console.log('processQueue: Fetching pending notifications...', { now })

  const { data: queue, error: queueError } = await supabase
    .from('notification_queue')
    .select(`
      *,
      tenants (
        whatsapp,
        whatsapp_sessions ( instance_name, status )
      )
    `)
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(50)

  if (queueError) {
    console.error('processQueue error:', queueError)
    return
  }

  console.log(`processQueue: Found ${queue?.length || 0} items to process`)

  for (const item of queue || []) {
    const tenant = Array.isArray(item.tenants) ? item.tenants[0] : item.tenants
    const session = Array.isArray(tenant?.whatsapp_sessions) ? tenant.whatsapp_sessions[0] : tenant?.whatsapp_sessions
    const attempts = item.attempts + 1

    if (!session?.instance_name || session.status !== 'connected') {
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', attempts, last_attempt_at: now, error_message: 'WhatsApp desconectado' })
        .eq('id', item.id)
      continue
    }

    try {
      console.log(`Sending notification ${item.id} to ${item.whatsapp_number}`)
      const response = await fetch(
        `${evolutionUrl}/message/sendText/${session.instance_name}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
          body: JSON.stringify({ number: item.whatsapp_number, text: item.message }),
        }
      )

      if (response.ok) {
        await supabase
          .from('notification_queue')
          .update({ status: 'sent', attempts, last_attempt_at: now, sent_at: now })
          .eq('id', item.id)
        
        await supabase.from('notifications').insert({
          tenant_id: item.tenant_id,
          customer_id: item.customer_id,
          type: item.type,
          message: item.message,
          whatsapp_number: item.whatsapp_number,
          success: true,
          sent_at: now
        })
      } else {
        const errData = await response.json().catch(() => ({}))
        const errMsg = errData?.message || `HTTP ${response.status}`
        console.error(`Failed to send ${item.id}:`, errMsg)
        
        const backoff = attempts === 1 ? 1 : 5 // Reduced backoff for testing
        const nextAttempt = new Date(Date.now() + backoff * 60 * 1000).toISOString()
        
        await supabase
          .from('notification_queue')
          .update({ attempts, last_attempt_at: now, next_attempt_at: nextAttempt, error_message: errMsg })
          .eq('id', item.id)
      }
    } catch (e) {
      console.error(`Error processing ${item.id}:`, e)
      await supabase
        .from('notification_queue')
        .update({ attempts, last_attempt_at: now, error_message: String(e) })
        .eq('id', item.id)
    }

    const randomDelay = Math.floor(Math.random() * (5000 - 1000 + 1) + 1000)
    await new Promise(r => setTimeout(r, randomDelay))
  }
}

function buildMessage(template: string, customer: any, tenant: any, appUrl: string): string {
  const paymentUrl = `${appUrl}/pagar/${customer.payment_token}`
  const valor = customer.monthly_value ? `R$ ${Number(customer.monthly_value).toFixed(2).replace('.', ',')}` : 'Consulte sua revenda'
  const vencimento = customer.expiration_date ? new Date(customer.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR') : ''

  return template
    .replace(/{nome}/g, customer.name || customer.username)
    .replace(/{valor}/g, valor)
    .replace(/{vencimento}/g, vencimento)
    .replace(/{link}/g, paymentUrl)
    .replace(/{revenda}/g, tenant.company_name || 'Sua revenda')
}

function getDefaultTemplate(type: string): string {
  const templates: Record<string, string> = {
    'D-3': 'Olá, {nome}! 👋\n\nSua assinatura IPTV vence em *3 dias*.\n\n💰 Valor: *{valor}*\n\nPague pelo link:\n{link}\n\n✅ Renovação automática de 30 dias.',
    'D-1': '⚠️ Olá, {nome}!\n\nSua assinatura vence *amanhã*.\n\n💰 Valor: *{valor}*\n\nRenove agora:\n{link}',
    'D-0': '🚨 Olá, {nome}!\n\nSua assinatura vence *hoje*!\n\n💰 Valor: *{valor}*\n\nPague agora:\n{link}',
    'overdue_1': '❌ Olá, {nome}!\n\nSua assinatura venceu *ontem*.\n\n💰 Valor: *{valor}*\n\nRegularize:\n{link}',
    'overdue_3': '❌ Olá, {nome}!\n\nSua assinatura está vencida há *3 dias*.\n\n💰 Valor: *{valor}*\n\nEvite perder o acesso:\n{link}',
    'overdue_7': '🚫 Olá, {nome}!\n\nÚltimo aviso! Assinatura vencida há *7 dias*.\n\n💰 Valor: *{valor}*\n\nRegularize antes do cancelamento:\n{link}',
  }
  return templates[type] || templates['D-0']
}

function formatNumber(number: string): string {
  const cleaned = number.replace(/\D/g, '')
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`
}
