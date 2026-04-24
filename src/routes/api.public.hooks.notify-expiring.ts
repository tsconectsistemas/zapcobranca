import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeEvolutionApiUrl } from "@/lib/evolution";

/**
 * Daily notification scheduler — called by pg_cron.
 * Sends WhatsApp reminders D-3, D-1, D-0 to active customers
 * via each tenant's Evolution API instance.
 *
 * Auth: Requires `Authorization: Bearer <CRON_SECRET>` header.
 */
export const Route = createFileRoute("/api/public/hooks/notify-expiring")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const CRON_SECRET = process.env.CRON_SECRET;

        if (!SUPABASE_URL || !SERVICE_ROLE) {
          return Response.json({ error: "Server misconfigured" }, { status: 500 });
        }

        const auth = request.headers.get("authorization") || "";
        if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const toDateStr = (d: Date) => d.toISOString().split("T")[0];

        const d1 = new Date(today);
        d1.setUTCDate(today.getUTCDate() + 1);
        const d3 = new Date(today);
        d3.setUTCDate(today.getUTCDate() + 3);

        const targets = [toDateStr(today), toDateStr(d1), toDateStr(d3)];

        const { data: customers, error } = await supabase
          .from("customers")
          .select(
            "id, tenant_id, name, username, whatsapp, expiration_date, monthly_value, payment_token",
          )
          .eq("status", "active")
          .in("expiration_date", targets)
          .not("whatsapp", "is", null);

        if (error) {
          console.error("[notify-expiring] fetch customers:", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        const results = {
          total: customers?.length || 0,
          sent: 0,
          failed: 0,
          skipped: 0,
        };

        const tenantCache = new Map<
          string,
          {
            apiUrl: string;
            apiKey: string;
            instanceName: string | null;
            connected: boolean;
          } | null
        >();

        async function getTenantCfg(tenantId: string) {
          if (tenantCache.has(tenantId)) return tenantCache.get(tenantId)!;

          const { data: secrets } = await supabase.rpc("get_tenant_secrets", {
            _tenant_id: tenantId,
          });
          const s = secrets?.[0];
          const apiUrl = normalizeEvolutionApiUrl(s?.evolution_api_url || "");
          const apiKey = s?.evolution_api_key || "";

          const { data: session } = await supabase
            .from("whatsapp_sessions")
            .select("instance_name, status")
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (!apiUrl || !apiKey || !session?.instance_name) {
            tenantCache.set(tenantId, null);
            return null;
          }

          const cfg = {
            apiUrl,
            apiKey,
            instanceName: session.instance_name,
            connected: session.status === "connected",
          };
          tenantCache.set(tenantId, cfg);
          return cfg;
        }

        const appUrl =
          process.env.APP_URL ||
          "https://project--e30b04c9-b9c6-40cd-a6cc-baf762543a71.lovable.app";

        for (const c of customers || []) {
          const expDate = c.expiration_date;
          if (!expDate || !c.whatsapp) {
            results.skipped++;
            continue;
          }

          const exp = new Date(`${expDate}T00:00:00Z`);
          const daysUntil = Math.round(
            (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );
          const notifType =
            daysUntil === 3
              ? "D-3"
              : daysUntil === 1
                ? "D-1"
                : daysUntil === 0
                  ? "D-0"
                  : null;
          if (!notifType) {
            results.skipped++;
            continue;
          }

          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("customer_id", c.id)
            .eq("type", notifType)
            .gte("sent_at", toDateStr(today))
            .maybeSingle();
          if (existing) {
            results.skipped++;
            continue;
          }

          const cfg = await getTenantCfg(c.tenant_id);
          if (!cfg || !cfg.connected) {
            results.skipped++;
            continue;
          }

          const name = c.name || c.username;
          const expFmt = new Date(`${expDate}T12:00:00`).toLocaleDateString("pt-BR");
          const valor = c.monthly_value
            ? `R$ ${Number(c.monthly_value).toFixed(2).replace(".", ",")}`
            : "";
          const paymentUrl = `${appUrl}/pagar/${c.payment_token}`;

          let message = "";
          if (notifType === "D-3") {
            message =
              `Olá, ${name}! 👋\n\n` +
              `Sua assinatura IPTV vence em *3 dias* (${expFmt}).\n\n` +
              `${valor ? `💰 Valor: *${valor}*\n\n` : ""}` +
              `Pague com facilidade pelo link:\n${paymentUrl}\n\n` +
              `Após o pagamento, sua assinatura é renovada automaticamente por 30 dias. ✅`;
          } else if (notifType === "D-1") {
            message =
              `⚠️ Olá, ${name}!\n\n` +
              `Sua assinatura IPTV vence *amanhã* (${expFmt}).\n\n` +
              `${valor ? `💰 Valor: *${valor}*\n\n` : ""}` +
              `Renove agora para não perder o acesso:\n${paymentUrl}\n\n` +
              `✅ Renovação automática em 30 dias após o pagamento.`;
          } else {
            message =
              `🚨 Olá, ${name}!\n\n` +
              `Sua assinatura IPTV vence *hoje*!\n\n` +
              `${valor ? `💰 Valor: *${valor}*\n\n` : ""}` +
              `Pague agora para não perder o acesso:\n${paymentUrl}\n\n` +
              `Após o pagamento, sua assinatura renova automaticamente. ✅`;
          }

          const digits = c.whatsapp.replace(/\D/g, "");
          const number = digits.startsWith("55") ? digits : `55${digits}`;

          let success = false;
          let errMsg: string | null = null;
          try {
            const res = await fetch(
              `${cfg.apiUrl}/message/sendText/${encodeURIComponent(cfg.instanceName!)}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: cfg.apiKey,
                },
                body: JSON.stringify({ number, text: message }),
              },
            );
            success = res.ok;
            if (!success) errMsg = `HTTP ${res.status}`;
          } catch (e) {
            errMsg = e instanceof Error ? e.message : "Network error";
          }

          await supabase.from("notifications").insert({
            tenant_id: c.tenant_id,
            customer_id: c.id,
            type: notifType,
            message,
            whatsapp_number: number,
            success,
            error_message: errMsg,
          });

          if (success) results.sent++;
          else results.failed++;
        }

        const planResults = { reminded: 0, downgraded: 0 };
        const appBaseUrl =
          process.env.APP_URL ||
          "https://project--e30b04c9-b9c6-40cd-a6cc-baf762543a71.lovable.app";

        try {
          const { data: expiring } = await supabase.rpc("get_tenants_plan_expiring", {
            _days: 3,
          });

          for (const t of expiring || []) {
            if (!t.whatsapp) continue;
            const cfg = await getTenantCfg(t.tenant_id);
            if (!cfg || !cfg.connected) continue;

            const expFmt = new Date(t.expires_at).toLocaleDateString("pt-BR");
            const text =
              `⚠️ Seu plano ZapCobrança *${t.plan_name}* vence em breve (${expFmt})!\n\n` +
              `Renove para não perder acesso às funcionalidades.\n\n` +
              `Acesse: ${appBaseUrl}/planos`;

            const digits = t.whatsapp.replace(/\D/g, "");
            const number = digits.startsWith("55") ? digits : `55${digits}`;

            try {
              await fetch(
                `${cfg.apiUrl}/message/sendText/${encodeURIComponent(cfg.instanceName!)}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: cfg.apiKey,
                  },
                  body: JSON.stringify({ number, text }),
                },
              );
              planResults.reminded++;
            } catch (e) {
              console.error("[notify-expiring] plan reminder error:", e);
            }
          }

          const { data: downgraded } = await supabase.rpc("expire_overdue_plans");
          planResults.downgraded = downgraded?.length ?? 0;
        } catch (e) {
          console.error("[notify-expiring] plan section error:", e);
        }

        console.log("[notify-expiring]", { ...results, ...planResults });
        return Response.json({ ...results, plans: planResults });
      },
    },
  },
});