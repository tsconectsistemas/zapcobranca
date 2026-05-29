import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEvolutionApiUrl } from "@/lib/evolution";
import { extractPixKey } from "@/utils/pix";

/**
 * Public webhook endpoint for Asaas payment notifications.
 * NOTE: In Lovable preview environment, this route might return 302 redirects.
 * Use the Supabase Edge Function instead for reliable external webhook delivery.
 * Edge Function URL: https://dxxbqeqdwagmtynfsmzw.supabase.co/functions/v1/asaas-webhook
 */

const PAYMENT_CONFIRMED_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendWhatsAppConfirmation(
  customer: {
    id: string;
    tenant_id: string;
    name: string | null;
    username: string;
    whatsapp: string | null;
  },
  _newExpiration: string,
  message: string,
) {
  if (!customer.whatsapp) return;

  const digits = customer.whatsapp.replace(/\D/g, "");
  const numberWithCountry = digits.startsWith("55") ? digits : `55${digits}`;

  await supabaseAdmin.from("notification_queue").insert({
    tenant_id: customer.tenant_id,
    customer_id: customer.id,
    type: "confirmed",
    message,
    whatsapp_number: numberWithCountry,
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    next_attempt_at: new Date().toISOString(),
  });
}

export const Route = createFileRoute("/api/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const event = payload?.event as string | undefined;
        const payment = payload?.payment;

        if (event === "TEST") {
          console.log("[asaas-webhook] Test event received");
          return json({ success: true, message: "Test event received" }, 200);
        }

        const pixKey: string =
          payment?.pixTransaction?.pixKey ||
          payment?.pixTransaction?.endToEndIdentifier ||
          "";

        // 1. Find the tenant and customer
        let tenantId: string | null = null;
        let customerId: string | null = null;
        let matchedCustomerData: any = null;

        if (payment?.id) {
          const { data: existing } = await supabaseAdmin
            .from("payments")
            .select("tenant_id, customer_id")
            .eq("asaas_payment_id", payment.id)
            .maybeSingle();
          if (existing) {
            tenantId = existing.tenant_id;
            customerId = existing.customer_id;
          }
        }

        if (!tenantId && pixKey) {
          const { data: customers } = await supabaseAdmin
            .from("customers")
            .select("id, tenant_id, pix_emv_payload, name, username, whatsapp, expiration_date, monthly_value")
            .not("pix_emv_payload", "is", null);

          const matched = customers?.find(c => {
            const extracted = extractPixKey(c.pix_emv_payload || "");
            return extracted === pixKey || (c.pix_emv_payload && c.pix_emv_payload.includes(pixKey));
          });

          if (matched) {
            tenantId = matched.tenant_id;
            customerId = matched.id;
            matchedCustomerData = matched;
          }
        }

        if (!tenantId) {
          console.log("[asaas-webhook] No matching customer/tenant found for pixKey:", pixKey);
          await supabaseAdmin.rpc("handle_asaas_webhook", { _payload: payload, _tenant_id: tenantId || "00000000-0000-0000-0000-000000000000" });
          return json({ matched: false, reason: "not_found" }, 200);
        }

        // 2. Get Secrets & Validate Token
        const { data: secrets } = await supabaseAdmin.rpc("get_tenant_secrets", {
          _tenant_id: tenantId
        });
        const cfg = secrets?.[0];
        
        if (cfg?.asaas_webhook_token) {
          const provided =
            request.headers.get("asaas-access-token") ||
            request.headers.get("Asaas-Access-Token");
          if (provided !== cfg.asaas_webhook_token) {
            console.error("[asaas-webhook] Unauthorized token for tenant:", tenantId);
            return json({ error: "unauthorized_token" }, 401);
          }
        }

        // 3. Process Payment (Database RPC)
        await supabaseAdmin.rpc("handle_asaas_webhook", { _payload: payload, _tenant_id: tenantId });

        if (!event || !PAYMENT_CONFIRMED_EVENTS.has(event)) {
          return json({ ignored: true, event: event ?? null }, 200);
        }

        // 4. Update Internal State
        try {
          const matched = matchedCustomerData || (await supabaseAdmin
            .from("customers")
            .select("id, tenant_id, expiration_date, monthly_value, name, username, whatsapp")
            .eq("id", customerId!)
            .single()).data;

          if (!matched) throw new Error("Customer not found after matching");

          if (payment?.id) {
            const { data: existing } = await supabaseAdmin
              .from("payments")
              .select("id")
              .eq("asaas_payment_id", payment.id)
              .eq("tenant_id", matched.tenant_id)
              .maybeSingle();
            if (existing) {
              console.log("[asaas-webhook] Duplicate payment ignored:", payment.id);
              return json({ duplicate: true, payment_id: payment.id }, 200);
            }
          }

          const today = new Date();
          const next = new Date(today);
          next.setDate(today.getDate() + 30);
          const newExpirationDate = next.toISOString().split("T")[0];
          const previousExpiration = matched.expiration_date;

          const { error: updateError } = await supabaseAdmin
            .from("customers")
            .update({
              expiration_date: newExpirationDate,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", matched.id)
            .eq("tenant_id", matched.tenant_id);
          if (updateError) throw updateError;

          const { error: paymentError } = await supabaseAdmin.from("payments").insert({
            tenant_id: matched.tenant_id,
            customer_id: matched.id,
            asaas_payment_id: payment?.id ?? null,
            asaas_pix_key: pixKey,
            amount:
              typeof payment?.value === "number"
                ? payment.value
                : matched.monthly_value,
            paid_at: new Date().toISOString(),
            previous_expiration: previousExpiration,
            new_expiration: newExpirationDate,
            raw_webhook: payload,
          });
          if (paymentError) throw paymentError;

          const displayName = matched.name || matched.username;
          const expirationFormatted = new Date(
            `${newExpirationDate}T12:00:00`,
          ).toLocaleDateString("pt-BR");
          const message =
            `✅ *Pagamento confirmado!*\n\n` +
            `Olá, ${displayName}! Recebemos seu pagamento com sucesso.\n\n` +
            `📺 Sua assinatura IPTV foi renovada!\n` +
            `📅 Novo vencimento: *${expirationFormatted}*\n\n` +
            `Obrigado por continuar conosco! 🙏`;

          await sendWhatsAppConfirmation(matched, newExpirationDate, message);


          return json(
            {
              success: true,
              customer: matched.username,
              newExpiration: newExpirationDate,
            },
            200,
          );
        } catch (error) {
          console.error("[asaas-webhook] processing error:", error);
          return json(
            {
              error: error instanceof Error ? error.message : "unknown_error",
            },
            500,
          );
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Asaas-Access-Token, asaas-access-token",
          },
        }),
    },
  },
});
