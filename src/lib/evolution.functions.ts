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

interface ResolvedTenant {
  tenantId: string;
  instanceName: string;
}

// Admin API URL/Key are now global, but each tenant has their own instance name.
async function resolveTenantConfig(
  userId: string,
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

  // Fetch instance name from secrets
  const { data: secrets } = await supabaseAdmin.rpc("get_tenant_secrets", {
    _tenant_id: tenant.id,
  });
  
  // Use canonical instance name
  const instanceName = secrets?.[0]?.evolution_instance || buildInstanceName(tenant.id);

  return {
    ok: true,
    cfg: { tenantId: tenant.id, instanceName },
  };
}

// Fetch Global Settings
async function getGlobalEvolutionConfig() {
  const { data: settings } = await supabaseAdmin
    .from('global_settings')
    .select('id, value')
    .in('id', ['evolution_api_url', 'evolution_api_key']);
  
  const map = Object.fromEntries((settings || []).map(s => [s.id, s.value]));
  return {
    apiUrl: normalizeEvolutionApiUrl(map['evolution_api_url'] || ""),
    apiKey: map['evolution_api_key'] || "",
  };
}

export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId);
    if (!r.ok) return { configured: false, connected: false, error: r.error };
    
    const global = await getGlobalEvolutionConfig();
    console.log("[WhatsApp] Global Config:", global);
    const configured = !!(global.apiUrl && global.apiKey);

    const { data: session } = await supabaseAdmin
      .from("whatsapp_sessions")
      .select("status, instance_name, connected_at")
      .eq("tenant_id", r.cfg.tenantId)
      .maybeSingle();

    let connected = session?.status === "connected";
    let state = session?.status ?? "disconnected";
    let connectedAt = session?.connected_at ?? null;

    if (!connected && configured) {
      const res = await getConnectionState(global.apiUrl, global.apiKey, r.cfg.instanceName);
      if (res.success && res.data?.state === "open") {
        connected = true;
        state = "connected";
        connectedAt = new Date().toISOString();
        await supabaseAdmin.from("whatsapp_sessions").upsert(
          {
            tenant_id: r.cfg.tenantId,
            instance_name: r.cfg.instanceName,
            status: "connected",
            connected_at: connectedAt,
          },
          { onConflict: "tenant_id" },
        );
      }
    }

    return {
      configured,
      connected,
      status: state,
      instanceName: r.cfg.instanceName,
      connectedAt,
    };
  });

export const connectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId);
    if (!r.ok) return { success: false, error: r.error };
    
    const global = await getGlobalEvolutionConfig();
    if (!global.apiUrl || !global.apiKey) return { success: false, error: "Sistema não configurado pelo admin", missing: true };

    // Try to create instance. If it already exists, Evolution will return 400/403,
    // but we can still try to get the QR code from the existing instance.
    try {
      const createRes = await createInstance(global.apiUrl, global.apiKey, r.cfg.instanceName);
      if (!createRes.success && !createRes.error?.includes("already exists")) {
        // If it's a real error (not just "already exists"), we might want to know, 
        // but often we just want to proceed to getQRCode if the instance is there.
        console.warn("[WhatsApp] Create instance warning:", createRes.error);
      }
    } catch (e) {
      console.error("[WhatsApp] Create instance error:", e);
    }

    const qr = await getQRCode(global.apiUrl, global.apiKey, r.cfg.instanceName);
    if (!qr.success) {
      return { 
        success: false, 
        error: qr.error?.includes("not found") 
          ? "Não foi possível encontrar ou criar a instância. Tente novamente." 
          : qr.error 
      };
    }

    await supabaseAdmin.from("whatsapp_sessions").upsert(
      {
        tenant_id: r.cfg.tenantId,
        instance_name: r.cfg.instanceName,
        status: "connecting",
        qr_code: qr.data?.code,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

    return { success: true, instanceName: r.cfg.instanceName, qrBase64: qr.data?.base64, qrCode: qr.data?.code };
  });

export const refreshQRCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId);
    if (!r.ok) return { success: false, error: r.error };
    
    const global = await getGlobalEvolutionConfig();
    const qr = await getQRCode(global.apiUrl, global.apiKey, r.cfg.instanceName);
    if (!qr.success) return { success: false, error: qr.error };
    return { success: true, qrBase64: qr.data?.base64, qrCode: qr.data?.code };
  });

export const pollConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId);
    if (!r.ok) return { success: false, error: r.error };
    
    const global = await getGlobalEvolutionConfig();
    const res = await getConnectionState(global.apiUrl, global.apiKey, r.cfg.instanceName);
    if (!res.success) return { success: false, error: res.error };

    const connected = res.data?.state === "open";
    if (connected) {
      await supabaseAdmin.from("whatsapp_sessions").upsert(
        {
          tenant_id: r.cfg.tenantId,
          instance_name: r.cfg.instanceName,
          status: "connected",
          connected_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );
    }
    return { success: true, connected };
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ number: z.string(), text: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const r = await resolveTenantConfig(context.userId);
    if (!r.ok) return { success: false, error: r.error };
    
    const global = await getGlobalEvolutionConfig();
    const res = await sendTextMessage(global.apiUrl, global.apiKey, r.cfg.instanceName, data.number, data.text);
    return { success: res.success, error: res.error };
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await resolveTenantConfig(context.userId);
    if (!r.ok) return { success: false, error: r.error };
    
    const global = await getGlobalEvolutionConfig();
    
    // Attempt to remove from Evolution API, but don't block on errors (e.g. instance already gone)
    try {
      await logoutInstance(global.apiUrl, global.apiKey, r.cfg.instanceName);
      await deleteInstance(global.apiUrl, global.apiKey, r.cfg.instanceName);
    } catch (e) {
      console.warn("[WhatsApp] Disconnect error (Evolution API):", e);
    }

    // Always clear the local session state
    await supabaseAdmin
      .from("whatsapp_sessions")
      .update({ 
        status: "disconnected", 
        connected_at: null,
        qr_code: null,
        updated_at: new Date().toISOString()
      })
      .eq("tenant_id", r.cfg.tenantId);

    return { success: true };
  });
