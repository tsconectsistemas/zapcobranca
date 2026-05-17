import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEvolutionApiUrl } from "./evolution";

const logoUrlSchema = z.union([
  z.literal(""),
  z.string().trim().url().max(500),
]);

const profileSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().max(20),
  logoUrl: logoUrlSchema,
});

const notificationSettingsSchema = z.object({
  d3: z.boolean(),
  d1: z.boolean(),
  d0: z.boolean(),
  confirmed: z.boolean(),
  sendHour: z.number().int().refine((value) => [7, 8, 9, 10, 11].includes(value)),
});

const notificationConfigSchema = z.object({
  enabled: z.boolean(),
  send_hour: z.number(),
  before_expiration: z.array(z.number()),
  after_expiration: z.array(z.number()),
  templates: z.record(z.string(), z.string()),
});

const deleteAccountSchema = z.object({
  confirmationText: z.string().trim().min(2).max(120),
});

async function getTenantId(userId: string) {
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("id, company_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tenant) {
    throw new Error("Revenda não encontrada");
  }

  return tenant;
}

export const getSettingsSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenant = await getTenantId(context.userId);

    const [{ data: fullTenant }, { data: secrets }, { data: session }] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select(
          "id, company_name, email, whatsapp, logo_url, plan, max_customers, active, notification_settings, notification_config",
        )
        .eq("id", tenant.id)
        .maybeSingle(),
      supabaseAdmin.rpc("get_tenant_secrets", { _tenant_id: tenant.id }),
      supabaseAdmin
        .from("whatsapp_sessions")
        .select("status, instance_name, connected_at")
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
    ]);

    const { count: customerCount } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .neq("status", "cancelled");

    const secretRow = secrets?.[0];
    const settings = (fullTenant?.notification_settings as
      | {
          d3?: boolean;
          d1?: boolean;
          d0?: boolean;
          confirmed?: boolean;
          send_hour?: number;
        }
      | null) ?? {
      d3: true,
      d1: true,
      d0: true,
      confirmed: true,
      send_hour: 9,
    };

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
        webhookToken: secretRow?.asaas_webhook_token ?? "",
        pixExpirationMinutes: secretRow?.pix_expiration_minutes ?? 60,
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
  .handler(async ({ data }) => {
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

export const saveNotificationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => notificationConfigSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenant = await getTenantId(context.userId);

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({
        notification_config: data as any,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenant.id);

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