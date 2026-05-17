import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const testAsaasConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .rpc("get_tenant_secrets", { _tenant_id: (await getTenantId(context.userId)).id });

    if (secretsError || !secrets?.[0]) {
      return { success: false, error: "Configurações Asaas não encontradas" };
    }

    const { asaas_api_key: apiKey, asaas_environment: env } = secrets[0];

    if (!apiKey) {
      return { success: false, error: "Chave de API não configurada" };
    }

    const baseUrl = env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

    try {
      const response = await fetch(`${baseUrl}/finance/balance`, {
        headers: {
          access_token: apiKey,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: data.errors?.[0]?.description || `Erro Asaas: ${response.statusText}` 
        };
      }

      const data = await response.json();
      return { success: true, balance: data.balance };
    } catch (err) {
      return { success: false, error: "Erro de conexão com Asaas" };
    }
  });

async function getTenantId(userId: string) {
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tenant) {
    throw new Error("Revenda não encontrada");
  }

  return tenant;
}
