import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Manually trigger the notification scheduler from the admin UI.
 * Calls the public hook with the CRON_SECRET so the same code path runs.
 */
export const triggerNotificationsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Only allow tenant owners
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!tenant) return { success: false, error: "Revenda não encontrada" };

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return { success: false, error: "CRON_SECRET não configurado" };
    }

    const baseUrl =
      process.env.APP_URL ||
      "https://project--e30b04c9-b9c6-40cd-a6cc-baf762543a71.lovable.app";

    try {
      const res = await fetch(`${baseUrl}/api/public/hooks/notify-expiring`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        total?: number;
        sent?: number;
        failed?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        return {
          success: false,
          error: data?.error || `HTTP ${res.status}`,
        };
      }
      return { success: true, ...data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  });
