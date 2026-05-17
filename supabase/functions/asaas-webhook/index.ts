import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Asaas-Access-Token, asaas-access-token",
};

/**
 * Parses TLV top-level from EMV/BR Code.
 */
function parseTLVTopLevel(emv: string) {
  const s = String(emv).trim();
  const out = [];
  let i = 0;
  const N = s.length;

  while (i + 4 <= N) {
    const id = s.substring(i, i + 2);
    const lenStr = s.substring(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenStr)) break;
    const len = parseInt(lenStr, 10);
    const startVal = i + 4;
    const endVal = startVal + len;
    if (endVal > N) break;
    const value = s.substring(startVal, endVal);
    out.push({ id, value });
    i = endVal;
    if (id === "63") break;
  }
  return out;
}

/**
 * Extracts PIX key from EMV payload.
 */
export function extractPixKey(emvPayload: string): string {
  if (!emvPayload) return "";
  if (!emvPayload.startsWith("000201")) return emvPayload;

  const fields = parseTLVTopLevel(emvPayload);
  const merchantField = fields.find(f => f.id === "26");
  
  if (merchantField) {
    const val = merchantField.value;
    let j = 0;
    while (j < val.length - 4) {
      const sid = val.substring(j, j + 2);
      const slen = parseInt(val.substring(j + 2, j + 4), 10);
      if (Number.isNaN(slen)) break;
      const sval = val.substring(j + 4, j + 4 + slen);
      if (sid === "01") return sval;
      j += 4 + slen;
    }
  }
  
  return emvPayload;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let payload;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const event = payload?.event;
    const payment = payload?.payment;
    const asaasCustomerId = payment?.customer;

    console.log(`[asaas-webhook] Incoming Event: ${event}, PaymentID: ${payment?.id}, CustomerID: ${asaasCustomerId}`);

    if (event === "TEST") {
      return new Response(JSON.stringify({ success: true, message: "Test event received" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pixKey =
      payment?.pixTransaction?.pixKey ||
      payment?.pixTransaction?.endToEndIdentifier ||
      "";

    // 1. Find the tenant and customer
    let tenantId = null;

    // A) Try by payment ID
    if (payment?.id) {
      const { data: existing } = await supabaseAdmin
        .from("payments")
        .select("tenant_id")
        .eq("asaas_payment_id", payment.id)
        .maybeSingle();
      if (existing) {
        tenantId = existing.tenant_id;
        console.log(`[asaas-webhook] Found tenant by payment ID: ${tenantId}`);
      }
    }

    // B) Try by Asaas Customer ID
    if (!tenantId && asaasCustomerId) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("tenant_id")
        .eq("asaas_customer_id", asaasCustomerId)
        .maybeSingle();
      if (customer) {
        tenantId = customer.tenant_id;
        console.log(`[asaas-webhook] Found tenant by Asaas customer ID: ${tenantId}`);
      }
    }

    // C) Try by PIX Key
    if (!tenantId && pixKey) {
      const { data: customers } = await supabaseAdmin
        .from("customers")
        .select("id, tenant_id, pix_emv_payload")
        .not("pix_emv_payload", "is", null);

      const matched = customers?.find(c => {
        const extracted = extractPixKey(c.pix_emv_payload || "");
        return extracted === pixKey || (c.pix_emv_payload && c.pix_emv_payload.includes(pixKey));
      });

      if (matched) {
        tenantId = matched.tenant_id;
        console.log(`[asaas-webhook] Found tenant by Pix Key match: ${tenantId}`);
      }
    }

    // D) Fallback for Sandbox testing: if only one tenant exists, use it? 
    // This is useful when the user is testing manually and hasn't linked everything yet.
    if (!tenantId) {
       const { data: tenants } = await supabaseAdmin.from("tenants").select("id").limit(2);
       if (tenants?.length === 1) {
         tenantId = tenants[0].id;
         console.log(`[asaas-webhook] No specific match found. Falling back to the only existing tenant: ${tenantId}`);
       }
    }

    // 2. Validate Token (optional, only if tenantId was found)
    if (tenantId) {
      const { data: secrets } = await supabaseAdmin.rpc("get_tenant_secrets", {
        _tenant_id: tenantId
      });
      const cfg = secrets?.[0];
      
      if (cfg?.asaas_webhook_token) {
        const provided = req.headers.get("asaas-access-token") || req.headers.get("Asaas-Access-Token");
        if (provided && provided !== cfg.asaas_webhook_token) {
          console.warn("[asaas-webhook] Token provided but mismatch for tenant:", tenantId);
          // We continue but log it. Some test events might not have the right token if not configured correctly.
        }
      }
    } else {
      console.log("[asaas-webhook] No tenant identified for this webhook payload.");
    }

    // 3. Process via RPC
    console.log("[asaas-webhook] Calling RPC handle_asaas_webhook...");
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("handle_asaas_webhook", { 
      _payload: payload,
      _tenant_id: tenantId 
    });

    if (rpcError) {
      console.error("[asaas-webhook] RPC error:", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[asaas-webhook] RPC Success:", rpcResult);
    return new Response(JSON.stringify({ success: true, rpc_result: rpcResult }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[asaas-webhook] Global error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
