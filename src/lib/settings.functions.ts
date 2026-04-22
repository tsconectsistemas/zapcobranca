import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  sendHour: z.number().int().refine((value) => [7, 8, 9, 10].includes(value)),
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