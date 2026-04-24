import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEvolutionApiUrl } from "./evolution";
import {
  createInstance,
  deleteInstance,
  getConnectionState,
  getQRCode,
  logoutInstance,
  resolveWorkingEvolutionApiUrl,
  sendTextMessage,
} from "./evolution.server";
...
const saveConfigSchema = z.object({
  apiUrl: z.string().trim().min(1).max(500),
  apiKey: z.string().trim().min(1).max(500),
});

export const saveEvolutionConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveConfigSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!tenant) return { success: false, error: "Revenda não encontrada" };

    const instanceName = `zapcobranca_${tenant.id
      .replace(/-/g, "")
      .substring(0, 8)}`;

    const resolved = await resolveWorkingEvolutionApiUrl(data.apiUrl, data.apiKey);
    if (!resolved.success) {
      return { success: false, error: resolved.error };
    }

    const normalizedApiUrl = normalizeEvolutionApiUrl(resolved.data.apiUrl);

    // Upsert directly via service role (RLS denies all direct access)
    const { error } = await supabaseAdmin.from("tenant_secrets").upsert(
      {
        tenant_id: tenant.id,
        evolution_api_url: normalizedApiUrl,
        evolution_api_key: data.apiKey,
        evolution_instance: instanceName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

    if (error) return { success: false, error: error.message };
    return { success: true, instanceName, apiUrl: normalizedApiUrl };
  });

// ─── Connect (create instance + return QR) ────────────────────────────────

export const connectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId, true);
    if (!r.ok) return { success: false, error: r.error, missing: r.missing };
    const { tenantId, apiUrl, apiKey, instanceName } = r.cfg;

    // Create (idempotent — Evolution returns 403/409 if exists; ignore)
    await createInstance({ apiUrl, apiKey }, instanceName);

    const qr = await getQRCode({ apiUrl, apiKey }, instanceName);
    if (!qr.success) {
      return { success: false, error: qr.error };
    }

    const qrData = qr.data as { base64?: string; code?: string } | null;
    const qrBase64 = qrData?.base64 || null;
    const qrCode = qrData?.code || null;

    // Persist session row
    await supabaseAdmin.from("whatsapp_sessions").upsert(
      {
        tenant_id: tenantId,
        instance_name: instanceName,
        status: "connecting",
        qr_code: qrCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

    return {
      success: true,
      instanceName,
      qrBase64,
      qrCode,
    };
  });

// ─── Refresh QR (re-issue if expired) ─────────────────────────────────────

export const refreshQRCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId, true);
    if (!r.ok) return { success: false, error: r.error };
    const { apiUrl, apiKey, instanceName } = r.cfg;

    const qr = await getQRCode({ apiUrl, apiKey }, instanceName);
    if (!qr.success) return { success: false, error: qr.error };
    const qrData = qr.data as { base64?: string; code?: string } | null;
    return {
      success: true,
      qrBase64: qrData?.base64 || null,
      qrCode: qrData?.code || null,
    };
  });

// ─── Poll connection state ───────────────────────────────────────────────

export const pollConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId, true);
    if (!r.ok) return { success: false, error: r.error, state: "unknown" };
    const { tenantId, apiUrl, apiKey, instanceName } = r.cfg;

    const res = await getConnectionState({ apiUrl, apiKey }, instanceName);
    if (!res.success) return { success: false, error: res.error, state: "unknown" };

    const raw = res.data as { instance?: { state?: string }; state?: string };
    const state = raw?.instance?.state || raw?.state || "unknown";
    const connected = state === "open";

    if (connected) {
      await supabaseAdmin.from("whatsapp_sessions").upsert(
        {
          tenant_id: tenantId,
          instance_name: instanceName,
          status: "connected",
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );
    }

    return { success: true, state, connected };
  });

// ─── Send test message ───────────────────────────────────────────────────

const sendTestSchema = z.object({
  number: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\d+$/, "Número deve conter apenas dígitos"),
  text: z.string().min(1).max(2000),
});

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendTestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const r = await resolveTenantConfig(context.userId, true);
    if (!r.ok) return { success: false, error: r.error };
    const { apiUrl, apiKey, instanceName } = r.cfg;

    const number = data.number.startsWith("55")
      ? data.number
      : `55${data.number}`;

    const res = await sendTextMessage(
      { apiUrl, apiKey },
      instanceName,
      number,
      data.text,
    );
    if (!res.success) return { success: false, error: res.error };
    return { success: true };
  });

// ─── Disconnect ──────────────────────────────────────────────────────────

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId, true);
    if (!r.ok) return { success: false, error: r.error };
    const { tenantId, apiUrl, apiKey, instanceName } = r.cfg;

    // Best-effort logout + delete; ignore individual errors
    await logoutInstance({ apiUrl, apiKey }, instanceName);
    await deleteInstance({ apiUrl, apiKey }, instanceName);

    await supabaseAdmin
      .from("whatsapp_sessions")
      .update({
        status: "disconnected",
        connected_at: null,
        qr_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    return { success: true };
  });
