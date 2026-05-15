import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const APP_URL = Deno.env.get('APP_URL') || 'https://zapcobranca.com.br'
const CRON_SECRET = 'W8ysOgBnzx3MEcUgmegn1Vik4rtNohp'

serve(async (req) => {
  // Security check
  const authHeader = req.headers.get('Authorization') || ''
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const toDateStr = (d: Date) => d.toISOString().split('T')[0]

  // Fetch all active tenants with WhatsApp connected
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select(`
      id, company_name, whatsapp,
      notification_config,
      tenant_secrets (
        evolution_api_url, evolution_api_key
      ),
      whatsapp_sessions (
        instance_name, status
      )
    `)
    .eq('active', true)

  if (tenantsError) {
    console.error('Error fetching tenants:', tenantsError)
    return new Response(
      JSON.stringify({ error: tenantsError.message }),
      { status: 500 }
    )
  }

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

    // Skip if notifications disabled
    if (config.enabled === false) {
      globalResults.tenants_skipped++
      continue
    }

    // Skip if WhatsApp not connected
    if (!session?.instance_name || session.status !== 'connected') {
      globalResults.tenants_skipped++
      // Alert tenant about disconnected WhatsApp if they have a number
      if (tenant.whatsapp) {
        await alertTenantWhatsAppDisconnected(tenant)
      }
      continue
    }

    const beforeDays: number[] = config.before_expiration || [3, 1, 0]
    const afterDays: number[] = config.after_expiration || [1, 3, 7]

    // Build target dates for before expiration (D-3, D-1, D-0)
    const beforeDates = beforeDays.map(d => {
      const date = new Date(today)
      date.setDate(today.getDate() + d)
      return { days: d, dateStr: toDateStr(date), type: `D-${d}` }
    })

    // Build target dates for after expiration (D+1, D+3, D+7)
    const afterDates = afterDays.map(d => {
      const date = new Date(today)
      date.setDate(today.getDate() - d)
      return { days: d, dateStr: toDateStr(date), type: `overdue_${d}` }
    })

    const allTargetDates = [...beforeDates, ...afterDates]
    const allDateStrings = allTargetDates.map(t => t.dateStr)

    // Fetch customers expiring/expired on target dates
    const { data: customers } = await supabase
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

    for (const customer of customers || []) {
      const target = allTargetDates.find(
        t => t.dateStr === customer.expiration_date
      )
      if (!target) continue

      // Check if already notified today for this type
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('type', target.type)
        .gte('sent_at', toDateStr(today) + 'T00:00:00Z')
        .maybeSingle()

      if (existing) continue

      // Build message from template
      const message = buildMessage(
        config.templates?.[
          target.type === 'D-0' ? 'd0' :
          target.type === 'D-1' ? 'd1' :
          target.type === 'D-3' ? 'd3' :
          target.type
        ] || getDefaultTemplate(target.type),
        customer,
        tenant
      )

      // Add to notification queue
      const { error: queueError } = await supabase
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

      if (!queueError) {
        globalResults.notifications_queued++
      }
    }

    globalResults.tenants_processed++
  }

  // Process the queue immediately after building it
  await processQueue()

  return new Response(
    JSON.stringify(globalResults),
    { status: 200 }
  )
})

// ─── PROCESS QUEUE ─────────────────────────────────────────
async function processQueue() {
  const now = new Date().toISOString()

  // Fetch pending notifications ready to send
  const { data: queue } = await supabase
    .from('notification_queue')
    .select(`
      *,
      tenants (
        whatsapp,
        tenant_secrets (
          evolution_api_url,
          evolution_api_key
        ),
        whatsapp_sessions ( instance_name, status )
      )
    `)
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(100)

  for (const item of queue || []) {
    const tenant = Array.isArray(item.tenants)
      ? item.tenants[0] : item.tenants
    const session = Array.isArray(tenant?.whatsapp_sessions)
      ? tenant.whatsapp_sessions[0] : tenant?.whatsapp_sessions
    const secrets = Array.isArray(tenant?.tenant_secrets)
      ? tenant.tenant_secrets[0] : tenant?.tenant_secrets

    const attempts = item.attempts + 1

    if (!session?.instance_name || session.status !== 'connected') {
      // Mark as failed — WhatsApp disconnected
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          attempts,
          last_attempt_at: now,
          error_message: 'WhatsApp desconectado',
        })
        .eq('id', item.id)

      await logNotification(
        item, false, 'WhatsApp desconectado'
      )
      await alertTenantFailure(item, tenant, 'WhatsApp desconectado')
      continue
    }

    try {
      // Send via Evolution API v2
      const response = await fetch(
        `${secrets?.evolution_api_url}/message/sendText/${session.instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': secrets?.evolution_api_key || '',
          },
          body: JSON.stringify({
            number: item.whatsapp_number,
            text: item.message,
          }),
        }
      )

      if (response.ok) {
        // Success — mark as sent
        await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            attempts,
            last_attempt_at: now,
            sent_at: now,
          })
          .eq('id', item.id)

        await logNotification(item, true, null)

      } else {
        const errData = await response.json().catch(() => ({}))
        const errMsg = errData?.message || `HTTP ${response.status}`

        if (attempts >= item.max_attempts) {
          // Max retries reached — mark as failed
          await supabase
            .from('notification_queue')
            .update({
              status: 'failed',
              attempts,
              last_attempt_at: now,
              error_message: errMsg,
            })
            .eq('id', item.id)

          await logNotification(item, false, errMsg)
          await alertTenantFailure(item, tenant, errMsg)

        } else {
          // Schedule retry with exponential backoff
          const backoffMinutes = attempts === 1 ? 15 : 60
          const nextAttempt = new Date(
            Date.now() + backoffMinutes * 60 * 1000
          ).toISOString()

          await supabase
            .from('notification_queue')
            .update({
              status: 'pending',
              attempts,
              last_attempt_at: now,
              next_attempt_at: nextAttempt,
              error_message: errMsg,
            })
            .eq('id', item.id)
        }
      }
    } catch (err) {
      const errMsg = String(err)
      const nextAttempt = attempts >= item.max_attempts
        ? null
        : new Date(Date.now() + 15 * 60 * 1000).toISOString()

      await supabase
        .from('notification_queue')
        .update({
          status: attempts >= item.max_attempts ? 'failed' : 'pending',
          attempts,
          last_attempt_at: now,
          next_attempt_at: nextAttempt,
          error_message: errMsg,
        })
        .eq('id', item.id)

      if (attempts >= item.max_attempts) {
        await logNotification(item, false, errMsg)
        await alertTenantFailure(item, tenant, errMsg)
      }
    }

    // Small delay between sends to avoid WhatsApp blocks
    await new Promise(r => setTimeout(r, 800))
  }
}

// ─── LOG NOTIFICATION ──────────────────────────────────────
async function logNotification(
  item: any,
  success: boolean,
  error: string | null
) {
  await supabase.from('notifications').insert({
    tenant_id: item.tenant_id,
    customer_id: item.customer_id,
    type: item.type,
    message: item.message,
    whatsapp_number: item.whatsapp_number,
    success,
    error_message: error,
    sent_at: new Date().toISOString(),
  })
}

// ─── ALERT TENANT ON FAILURE ───────────────────────────────
async function alertTenantFailure(
  item: any,
  tenant: any,
  error: string
) {
  const secrets = Array.isArray(tenant?.tenant_secrets)
    ? tenant.tenant_secrets[0] : tenant?.tenant_secrets

  if (!tenant?.whatsapp || !secrets?.evolution_api_url) return

  const session = Array.isArray(tenant.whatsapp_sessions)
    ? tenant.whatsapp_sessions[0]
    : tenant.whatsapp_sessions

  if (!session?.instance_name || session.status !== 'connected') return

  const { data: customer } = await supabase
    .from('customers')
    .select('name, username, whatsapp')
    .eq('id', item.customer_id)
    .single()

  const clientName = customer?.name || customer?.username || 'Cliente'
  const alertMessage =
    `⚠️ *ZapCobrança — Falha no envio*\n\n` +
    `Não conseguimos enviar a notificação para:\n` +
    `👤 *${clientName}*\n` +
    `📱 ${customer?.whatsapp || 'Sem número'}\n` +
    `📋 Tipo: ${item.type}\n\n` +
    `❌ Erro: ${error}\n\n` +
    `Tentativas: ${item.attempts} de ${item.max_attempts}\n\n` +
    `Verifique a conexão do WhatsApp em:\n` +
    `${Deno.env.get('APP_URL') || 'https://zapcobranca.com.br'}/whatsapp`

  const tenantNumber = formatNumber(tenant.whatsapp)

  await fetch(
    `${secrets.evolution_api_url}/message/sendText/${session.instance_name}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': secrets.evolution_api_key || '',
      },
      body: JSON.stringify({
        number: tenantNumber,
        text: alertMessage,
      }),
    }
  ).catch(() => null)
}

// ─── ALERT TENANT WHATSAPP DISCONNECTED ───────────────────
async function alertTenantWhatsAppDisconnected(tenant: any) {
  // Only alert once per day — check recent notifications
  const today = new Date().toISOString().split('T')[0]
  const { data: recent } = await supabase
    .from('notifications')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('type', 'system_whatsapp_disconnected')
    .gte('sent_at', today + 'T00:00:00Z')
    .maybeSingle()

  if (recent) return

  // Log the alert
  await supabase.from('notifications').insert({
    tenant_id: tenant.id,
    customer_id: null,
    type: 'system_whatsapp_disconnected',
    message: 'WhatsApp desconectado — notificações pausadas',
    success: false,
    error_message: 'Instância desconectada',
  })
}

// ─── BUILD MESSAGE FROM TEMPLATE ───────────────────────────
function buildMessage(
  template: string,
  customer: any,
  tenant: any
): string {
  const paymentUrl = `${APP_URL}/pagar/${customer.payment_token}`
  const valor = customer.monthly_value
    ? `R$ ${Number(customer.monthly_value)
        .toFixed(2)
        .replace('.', ',')}`
    : 'Consulte sua revenda'
  const vencimento = customer.expiration_date
    ? new Date(customer.expiration_date + 'T12:00:00')
        .toLocaleDateString('pt-BR')
    : ''

  return template
    .replace(/{nome}/g, customer.name || customer.username)
    .replace(/{valor}/g, valor)
    .replace(/{vencimento}/g, vencimento)
    .replace(/{link}/g, paymentUrl)
    .replace(/{revenda}/g, tenant.company_name || 'Sua revenda')
}

// ─── DEFAULT TEMPLATES ─────────────────────────────────────
function getDefaultTemplate(type: string): string {
  const templates: Record<string, string> = {
    'D-3':
      'Olá, {nome}! 👋\n\nSua assinatura IPTV vence em *3 dias*.\n\n' +
      '💰 Valor: *{valor}*\n\nPague pelo link:\n{link}\n\n' +
      '✅ Renovação automática de 30 dias.',
    'D-1':
      '⚠️ Olá, {nome}!\n\nSua assinatura vence *amanhã*.\n\n' +
      '💰 Valor: *{valor}*\n\nRenove agora:\n{link}',
    'D-0':
      '🚨 Olá, {nome}!\n\nSua assinatura vence *hoje*!\n\n' +
      '💰 Valor: *{valor}*\n\nPague agora:\n{link}',
    'overdue_1':
      '❌ Olá, {nome}!\n\nSua assinatura venceu *ontem*.\n\n' +
      '💰 Valor: *{valor}*\n\nRegularize:\n{link}',
    'overdue_3':
      '❌ Olá, {nome}!\n\nSua assinatura está vencida há *3 dias*.\n\n' +
      '💰 Valor: *{valor}*\n\nEvite perder o acesso:\n{link}',
    'overdue_7':
      '🚫 Olá, {nome}!\n\nÚltimo aviso! Assinatura vencida há *7 dias*.\n\n' +
      '💰 Valor: *{valor}*\n\nRegularize antes do cancelamento:\n{link}',
  }
  return templates[type] || templates['D-0']
}

// ─── FORMAT WHATSAPP NUMBER ────────────────────────────────
function formatNumber(number: string): string {
  const cleaned = number.replace(/\D/g, '')
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`
}
