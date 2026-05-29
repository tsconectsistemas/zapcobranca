import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Manually trigger the notification scheduler from the admin UI.
 * Calls the Edge Function notify-expiring.
 */
export const triggerNotificationsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    
    if (!tenant) return { success: false, error: "Revenda não encontrada" };

    const cronSecret = process.env.CRON_SECRET || "W8ysOgBnzx3MEcUgmegn1Vik4rtNohp";
    const supabaseUrl = process.env.SUPABASE_URL || "https://dxxbqeqdwagmtynfsmzw.supabase.co";

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/notify-expiring`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      
      const data = await res.json().catch(() => ({}));
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

export const retryNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!tenant) throw new Error("Não autorizado");

    const { error } = await supabaseAdmin
      .from("notification_queue")
      .update({
        status: "pending",
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", data.id)
      .eq("tenant_id", tenant.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  });

