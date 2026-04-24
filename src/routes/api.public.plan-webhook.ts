import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEvolutionApiUrl } from "@/lib/evolution";
...
  try {
    await fetch(
      `${normalizeEvolutionApiUrl(cfg.evolution_api_url || "")}/message/sendText/${encodeURIComponent(session.instance_name)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.evolution_api_key },
        body: JSON.stringify({ number, text }),
      },
    );
  } catch (err) {
    console.error("[plan-webhook] notify error:", err);
  }
}

export const Route = createFileRoute("/api/public/plan-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedToken = process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN;
        if (expectedToken) {
          const provided =
            request.headers.get("asaas-access-token") ||
            request.headers.get("Asaas-Access-Token");
          if (provided !== expectedToken) return json({ error: "unauthorized" }, 401);
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const event = payload?.event as string | undefined;
        const payment = payload?.payment;
        if (!event || !PAID_EVENTS.has(event)) {
          return json({ ignored: true, event: event ?? null }, 200);
        }
        if (!payment?.id) {
          return json({ error: "no_payment_id" }, 400);
        }

        try {
          const { data: rows, error } = await supabaseAdmin.rpc(
            "confirm_plan_payment",
            {
              _asaas_payment_id: payment.id,
              _amount: typeof payment.value === "number" ? payment.value : 0,
              _raw: payload as never,
            },
          );
          if (error) throw error;
          const row = rows?.[0];
          if (!row) return json({ matched: false }, 200);

          // Resolve plan name + max for the WhatsApp message
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("name, max_customers")
            .eq("id", row.plan_id)
            .maybeSingle();

          await notifyTenant(
            row.tenant_whatsapp,
            row.tenant_id,
            plan?.name ?? row.plan_id,
            row.expires_at,
            plan?.max_customers ?? null,
          );

          return json({ success: true, tenant_id: row.tenant_id, plan: row.plan_id }, 200);
        } catch (err) {
          console.error("[plan-webhook] error:", err);
          return json(
            { error: err instanceof Error ? err.message : "unknown_error" },
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
