import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeEvolutionApiUrl } from "@/lib/evolution";
...
          const s = secrets?.[0];
          const apiUrl = normalizeEvolutionApiUrl(s?.evolution_api_url || "");
          const apiKey = s?.evolution_api_key || "";
...
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

        // ─── Plan expiration handling (platform subscriptions) ────────────
        const planResults = { reminded: 0, downgraded: 0 };
        const appBaseUrl =
          process.env.APP_URL ||
          "https://project--e30b04c9-b9c6-40cd-a6cc-baf762543a71.lovable.app";

        try {
          // 1. Send reminders to tenants whose plan expires in <= 3 days
          const { data: expiring } = await supabase.rpc(
            "get_tenants_plan_expiring",
            { _days: 3 },
          );

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

          // 2. Auto-downgrade expired plans
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
