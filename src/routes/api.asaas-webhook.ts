import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEvolutionApiUrl } from "@/lib/evolution";
...
  try {
    const baseUrl = normalizeEvolutionApiUrl(cfg.evolution_api_url || "");
    const res = await fetch(
      `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.evolution_api_key || "",
        },
        body: JSON.stringify({ number: numberWithCountry, text: message }),
      },
    );
    if (!res.ok) {
      success = false;
      errorMessage = `Evolution responded ${res.status}`;
    }
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await supabaseAdmin.from("notifications").insert({
    tenant_id: customer.tenant_id,
    customer_id: customer.id,
    type: "confirmed",
    message,
    whatsapp_number: numberWithCountry,
    success,
    error_message: errorMessage,
  });
}

export const Route = createFileRoute("/api/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional shared-secret validation (set ASAAS_WEBHOOK_TOKEN in secrets
        // and configure the same value as the Asaas auth token in the dashboard).
        const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
        if (expectedToken) {
          const provided =
            request.headers.get("asaas-access-token") ||
            request.headers.get("Asaas-Access-Token");
          if (provided !== expectedToken) {
            return json({ error: "unauthorized" }, 401);
          }
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const event = payload?.event as string | undefined;
        const payment = payload?.payment;

        if (!event || !PAYMENT_CONFIRMED_EVENTS.has(event)) {
          return json({ ignored: true, event: event ?? null }, 200);
        }

        try {
          const pixKey: string =
            payment?.pixTransaction?.pixKey ||
            payment?.pixTransaction?.endToEndIdentifier ||
            "";

          if (!pixKey) {
            return json({ matched: false, reason: "no_pix_key" }, 200);
          }

          // Find candidate customers (only those with EMV payload). Service
          // role bypasses RLS, so tenant scoping is enforced by the match.
          const { data: customers, error: searchError } = await supabaseAdmin
            .from("customers")
            .select(
              "id, tenant_id, expiration_date, monthly_value, name, username, whatsapp, pix_emv_payload",
            )
            .not("pix_emv_payload", "is", null)
            .limit(5000);

          if (searchError) throw searchError;

          const matched = customers?.find(
            (c) => c.pix_emv_payload?.includes(pixKey),
          );

          if (!matched) {
            return json({ matched: false }, 200);
          }

          // Idempotency: if this asaas_payment_id was already processed, skip.
          if (payment?.id) {
            const { data: existing } = await supabaseAdmin
              .from("payments")
              .select("id")
              .eq("asaas_payment_id", payment.id)
              .eq("tenant_id", matched.tenant_id)
              .maybeSingle();
            if (existing) {
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

          const { error: paymentError } = await supabaseAdmin
            .from("payments")
            .insert({
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
          console.error("[asaas-webhook] error:", error);
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
