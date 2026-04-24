import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEvolutionApiUrl } from "./evolution";
...
    return {
      tenant: {
        id: fullTenant?.id ?? tenant.id,
        companyName: fullTenant?.company_name ?? tenant.company_name,
        email: fullTenant?.email ?? "",
        whatsapp: fullTenant?.whatsapp ?? "",
        logoUrl: fullTenant?.logo_url ?? "",
        plan: fullTenant?.plan ?? "free",
        maxCustomers: fullTenant?.max_customers ?? 50,
        active: fullTenant?.active ?? true,
        notificationSettings: {
          d3: settings.d3 ?? true,
          d1: settings.d1 ?? true,
          d0: settings.d0 ?? true,
          confirmed: settings.confirmed ?? true,
          sendHour: settings.send_hour ?? 9,
        },
        customerCount: customerCount ?? 0,
      },
      asaas: {
        environment: secretRow?.asaas_environment === "production" ? "production" : "sandbox",
        hasApiKey: Boolean(secretRow?.asaas_api_key),
      },
      evolution: {
        apiUrl: normalizeEvolutionApiUrl(secretRow?.evolution_api_url ?? ""),
        hasApiKey: Boolean(secretRow?.evolution_api_key),
        instanceName:
          secretRow?.evolution_instance ?? `zapcobranca_${tenant.id.replace(/-/g, "").slice(0, 8)}`,
      },
      whatsapp: {
        status: session?.status ?? "disconnected",
        connectedAt: session?.connected_at ?? null,
      },
    };
  });

export const saveTenantProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenant = await getTenantId(context.userId);

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({
        company_name: data.companyName,
        whatsapp: data.whatsapp || null,
        logo_url: data.logoUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenant.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  });

export const saveNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => notificationSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.rpc("update_my_notification_settings", {
      _d3: data.d3,
      _d1: data.d1,
      _d0: data.d0,
      _confirmed: data.confirmed,
      _send_hour: data.sendHour,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteAccountSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenant = await getTenantId(context.userId);

    if (data.confirmationText !== tenant.company_name) {
      return { success: false, error: "Digite o nome exato da empresa para confirmar." };
    }

    await supabaseAdmin.from("notifications").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("payments").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("customers").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("whatsapp_sessions").delete().eq("tenant_id", tenant.id);
    await supabaseAdmin.from("tenant_secrets").delete().eq("tenant_id", tenant.id);

    const { error: deleteTenantError } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenant.id);

    if (deleteTenantError) {
      return { success: false, error: deleteTenantError.message };
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(context.userId);

    if (deleteUserError) {
      return { success: false, error: deleteUserError.message };
    }

    return { success: true };
  });