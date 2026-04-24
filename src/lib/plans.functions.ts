import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const checkoutSchema = z.object({
  planId: z.enum(["pro", "business"]),
  billingCycle: z.enum(["monthly", "yearly"]),
});

const statusSchema = z.object({
  paymentId: z.string().uuid(),
});

/** Returns the catalog of active plans for display on /planos. */
export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("id, name, price_monthly, price_yearly, max_customers, features, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Returns the current tenant's plan, usage and expiration. */
export const getMyPlanStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.rpc("get_my_plan_status");
    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  });

/**
 * Starts a plan checkout. Creates a pending plan_payment row and tries to
 * generate a real PIX via Asaas if PLATFORM_ASAAS_API_KEY is configured.
 * If not configured, falls back to a placeholder payload so the flow can be
 * tested end-to-end (the user can later wire the real key).
 */
export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("start_plan_checkout", {
      _plan_id: data.planId,
      _billing_cycle: data.billingCycle,
    } as never);

    if (error) return { success: false as const, error: error.message };
    const row = rows?.[0];
    if (!row) return { success: false as const, error: "Falha ao iniciar checkout" };

    // Try Asaas integration (optional — graceful fallback)
    const asaasKey = process.env.PLATFORM_ASAAS_API_KEY;
    const asaasEnv = process.env.PLATFORM_ASAAS_ENV === "production" ? "production" : "sandbox";

    let pixEmv: string | null = null;
    let pixImage: string | null = null;
    let asaasPaymentId: string | null = null;
    let placeholder = false;

    if (asaasKey) {
      try {
        const baseUrl = asaasEnv === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

        // Get tenant info for Asaas customer
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("company_name, email, whatsapp")
          .eq("id", row.tenant_id)
          .maybeSingle();

        // Find or create Asaas customer
        const custRes = await fetch(`${baseUrl}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: asaasKey },
          body: JSON.stringify({
            name: tenant?.company_name || "ZapCobrança",
            email: tenant?.email,
            mobilePhone: tenant?.whatsapp?.replace(/\D/g, "") || undefined,
            externalReference: row.tenant_id,
          }),
        });
        const cust = (await custRes.json()) as { id?: string };

        if (cust?.id) {
          const due = new Date();
          due.setDate(due.getDate() + 1);
          const payRes = await fetch(`${baseUrl}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", access_token: asaasKey },
            body: JSON.stringify({
              customer: cust.id,
              billingType: "PIX",
              value: Number(row.amount),
              dueDate: due.toISOString().split("T")[0],
              description: `ZapCobrança ${row.plan_name} (${row.billing_cycle === "yearly" ? "Anual" : "Mensal"})`,
              externalReference: row.payment_id,
            }),
          });
          const pay = (await payRes.json()) as { id?: string };
          if (pay?.id) {
            asaasPaymentId = pay.id;
            const qrRes = await fetch(`${baseUrl}/payments/${pay.id}/pixQrCode`, {
              headers: { access_token: asaasKey },
            });
            const qr = (await qrRes.json()) as { payload?: string; encodedImage?: string };
            pixEmv = qr.payload ?? null;
            pixImage = qr.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : null;
          }
        }
      } catch (err) {
        console.error("[startPlanCheckout] Asaas error:", err);
      }
    }

    if (!pixEmv) {
      placeholder = true;
      // Placeholder payload — to be replaced when PLATFORM_ASAAS_API_KEY is added.
      // Still saves the plan_payment record so the manual confirmation flow
      // (via webhook simulation) can complete the checkout in dev.
      pixEmv = `PLACEHOLDER-PIX-${row.payment_id}-${row.amount}`;
      asaasPaymentId = `placeholder_${row.payment_id}`;
    }

    await supabaseAdmin.rpc("attach_plan_pix", {
      _payment_id: row.payment_id,
      _asaas_payment_id: asaasPaymentId ?? "",
      _pix_emv: pixEmv,
      _pix_image: pixImage ?? "",
    });

    return {
      success: true as const,
      paymentId: row.payment_id as string,
      planId: row.plan_id as string,
      planName: row.plan_name as string,
      billingCycle: row.billing_cycle as string,
      amount: Number(row.amount),
      pixEmv,
      pixImage,
      placeholder,
    };
  });

/** Polled by the checkout modal every 10s until status === "paid". */
export const getPlanPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("get_plan_payment_status", {
      _payment_id: data.paymentId,
    });
    if (error) return { status: "error" as const, error: error.message };
    const row = rows?.[0];
    return {
      status: (row?.status ?? "pending") as string,
      planId: row?.plan_id ?? null,
      expiresAt: row?.expires_at ?? null,
    };
  });

/**
 * Dev-only: simulate webhook confirmation when running without a real
 * PLATFORM_ASAAS_API_KEY. Marks the plan_payment as paid and activates the
 * plan. No-op (returns error) when a real Asaas key is configured — in that
 * case payment must come from the actual webhook.
 */
export const simulatePlanPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (process.env.PLATFORM_ASAAS_API_KEY) {
      return { success: false as const, error: "Simulação desabilitada em produção" };
    }

    // Ensure the payment belongs to the calling tenant
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!tenant) return { success: false as const, error: "Revenda não encontrada" };

    const { data: pp } = await supabaseAdmin
      .from("plan_payments")
      .select("id, tenant_id, asaas_payment_id, amount")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!pp || pp.tenant_id !== tenant.id) {
      return { success: false as const, error: "Pagamento não encontrado" };
    }

    const { error } = await supabaseAdmin.rpc("confirm_plan_payment", {
      _asaas_payment_id: pp.asaas_payment_id ?? "",
      _amount: Number(pp.amount),
      _raw: { simulated: true } as never,
    });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });
