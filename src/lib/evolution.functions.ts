import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildInstanceName, normalizeEvolutionApiUrl } from "./evolution";
import {
  createInstance,
  deleteInstance,
  fetchInstances,
  getConnectionState,
  getQRCode,
  logoutInstance,
  resolveWorkingEvolutionApiUrl,
  sendTextMessage,
} from "./evolution.server";

/**
 * All Evolution API calls are proxied through these server functions so the
 * tenant's API key never leaves the server. The auth middleware ensures the
 * caller is logged in, and we resolve their tenant_id server-side — clients
 * cannot pass arbitrary tenant_ids.
 */

interface ResolvedTenant {
  tenantId: string;
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

async function resolveTenantConfig(
  userId: string,
  requireConfig: boolean,
): Promise<
  | { ok: true; cfg: ResolvedTenant }
  | { ok: false; error: string; missing?: boolean }
> {
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !tenant) {
    return { ok: false, error: "Revenda não encontrada para este usuário" };
  }

  const { data: secrets } = await supabaseAdmin.rpc("get_tenant_secrets", {
    _tenant_id: tenant.id,
  });
  const cfg = secrets?.[0];
  const apiUrl = normalizeEvolutionApiUrl(cfg?.evolution_api_url || "");
  const apiKey = cfg?.evolution_api_key || "";

  if (requireConfig && (!apiUrl || !apiKey)) {
    return { ok: false, error: "Evolution API não configurada", missing: true };
  }

  // Always use the canonical v2 instance name format. If the stored value
  // was generated under an older format, this overrides it.
  const instanceName = cfg?.evolution_instance || buildInstanceName(tenant.id);

  return {
    ok: true,
    cfg: { tenantId: tenant.id, apiUrl, apiKey, instanceName },
  };
}

export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId, false);
    if (!r.ok) return { configured: false, connected: false, error: r.error };

    const configured = !!(r.cfg.apiUrl && r.cfg.apiKey);

    const { data: session } = await supabaseAdmin
      .from("whatsapp_sessions")
      .select("status, instance_name, connected_at")
      .eq("tenant_id", r.cfg.tenantId)
      .maybeSingle();

    let connected = session?.status === "connected";
    let state = session?.status ?? "disconnected";
    let connectedAt = session?.connected_at ?? null;

    // If DB doesn't say connected, but we are configured, let's double check with Evolution
    if (!connected && configured) {
      const res = await getConnectionState(r.cfg.apiUrl, r.cfg.apiKey, r.cfg.instanceName);
      if (res.success && res.data?.state === "open") {
        connected = true;
        state = "connected";
        connectedAt = new Date().toISOString();

        // Update DB so it's synced
        await supabaseAdmin.from("whatsapp_sessions").upsert(
          {
            tenant_id: r.cfg.tenantId,
            instance_name: r.cfg.instanceName,
            status: "connected",
            connected_at: connectedAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" },
        );
      }
    }

    return {
      configured,
      connected,
      status: state,
      instanceName: session?.instance_name || r.cfg.instanceName,
      connectedAt,
      apiUrl: r.cfg.apiUrl,
    };
  });

const saveConfigSchema = z.object({
  apiUrl: z.string().trim().min(1).max(500),
  apiKey: z.string().trim().max(500).optional(),
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

    const instanceName = buildInstanceName(tenant.id);

    const { data: existingSecrets } = await supabaseAdmin.rpc("get_tenant_secrets", {
      _tenant_id: tenant.id,
    });
    const effectiveApiKey = data.apiKey || existingSecrets?.[0]?.evolution_api_key;

    if (!effectiveApiKey) {
      return { success: false, error: "API Key é necessária" };
    }

    const resolved = await resolveWorkingEvolutionApiUrl(data.apiUrl, effectiveApiKey);
    if (!resolved.success) {
      return { success: false, error: resolved.error };
    }

    const normalizedApiUrl = normalizeEvolutionApiUrl(
      resolved.data?.apiUrl ?? data.apiUrl,
    );

    const { error } = await supabaseAdmin.from("tenant_secrets").upsert(
      {
        tenant_id: tenant.id,
        evolution_api_url: normalizedApiUrl,
        evolution_api_key: effectiveApiKey,
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
    await createInstance(apiUrl, apiKey, instanceName);

    const qr = await getQRCode(apiUrl, apiKey, instanceName);
    if (!qr.success) {
      return { success: false, error: qr.error };
    }

    const qrBase64 = qr.data?.base64 ?? null;
    const qrCode = qr.data?.code ?? null;

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

    const qr = await getQRCode(apiUrl, apiKey, instanceName);
    if (!qr.success) return { success: false, error: qr.error };
    return {
      success: true,
      qrBase64: qr.data?.base64 ?? null,
      qrCode: qr.data?.code ?? null,
    };
  });

// ─── Poll connection state ───────────────────────────────────────────────

export const pollConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId, true);
    if (!r.ok) return { success: false, error: r.error, state: "unknown" };
    const { tenantId, apiUrl, apiKey, instanceName } = r.cfg;

    const res = await getConnectionState(apiUrl, apiKey, instanceName);
    if (!res.success) return { success: false, error: res.error, state: "unknown" };

    const state = res.data?.state ?? "unknown";
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

    const res = await sendTextMessage(
      apiUrl,
      apiKey,
      instanceName,
      data.number,
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
    await logoutInstance(apiUrl, apiKey, instanceName);
    await deleteInstance(apiUrl, apiKey, instanceName);

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

// ─── Debug: raw fetchInstances response ──────────────────────────────────

export const debugFetchInstances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId, true);
    if (!r.ok) return { success: false, error: r.error };
    const { apiUrl, apiKey, instanceName } = r.cfg;
    const res = await fetchInstances(apiUrl, apiKey);
    return {
      success: res.success,
      error: res.success ? undefined : res.error,
      raw: res.success ? JSON.stringify(res.data, null, 2) : undefined,
      apiUrl,
      instanceName,
    };
  });
