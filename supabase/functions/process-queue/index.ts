import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') || ''
  const secret = Deno.env.get('CRON_SECRET') || ''
  if (secret && authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Re-use processQueue logic
  const now = new Date().toISOString()
  const { data: queue } = await supabase
    .from('notification_queue')
    .select(`
      *,
      tenants (
        evolution_api_url, evolution_api_key, whatsapp,
        whatsapp_sessions ( instance_name, status )
      )
    `)
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .lt('attempts', 3)
    .order('next_attempt_at', { ascending: true })
    .limit(50)

  let sent = 0, failed = 0

  for (const item of queue || []) {
    const tenant = Array.isArray(item.tenants)
      ? item.tenants[0] : item.tenants
    const session = Array.isArray(tenant?.whatsapp_sessions)
      ? tenant.whatsapp_sessions[0] : tenant?.whatsapp_sessions

    if (!session?.instance_name || session.status !== 'connected') {
      failed++
      continue
    }

    try {
      const response = await fetch(
        `${tenant.evolution_api_url}/message/sendText/${session.instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': tenant.evolution_api_key || '',
          },
          body: JSON.stringify({
            number: item.whatsapp_number,
            text: item.message,
          }),
        }
      )

      if (response?.ok) {
        await supabase
          .from('notification_queue')
          .update({ 
            status: 'sent', 
            sent_at: now,
            attempts: item.attempts + 1,
            last_attempt_at: now 
          })
          .eq('id', item.id)

        await supabase.from('notifications').insert({
          tenant_id: item.tenant_id,
          customer_id: item.customer_id,
          type: item.type,
          message: item.message,
          whatsapp_number: item.whatsapp_number,
          success: true,
        })
        sent++
      } else {
        failed++
        // Log attempt and reschedule or fail
        const attempts = item.attempts + 1
        const errData = await response?.json().catch(() => ({}))
        const errMsg = errData?.message || `HTTP ${response?.status}`

        if (attempts >= item.max_attempts) {
          await supabase
            .from('notification_queue')
            .update({ status: 'failed', attempts, last_attempt_at: now, error_message: errMsg })
            .eq('id', item.id)
        } else {
          const backoff = attempts === 1 ? 15 : 60
          const nextAttempt = new Date(Date.now() + backoff * 60 * 1000).toISOString()
          await supabase
            .from('notification_queue')
            .update({ attempts, last_attempt_at: now, next_attempt_at: nextAttempt, error_message: errMsg })
            .eq('id', item.id)
        }
      }
    } catch (e) {
      failed++
    }

    await new Promise(r => setTimeout(r, 800))
  }

  return new Response(
    JSON.stringify({ sent, failed }),
    { status: 200 }
  )
})
