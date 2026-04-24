
-- 1) Tenants: colunas de controle de plano
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_payment_token uuid DEFAULT gen_random_uuid();

UPDATE public.tenants SET plan_payment_token = gen_random_uuid() WHERE plan_payment_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_plan_payment_token_key ON public.tenants(plan_payment_token);

-- 2) Tabela de planos
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_monthly numeric(10,2) NOT NULL,
  price_yearly numeric(10,2) NOT NULL,
  max_customers integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone authed can read plans" ON public.plans;
CREATE POLICY "anyone authed can read plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (active = true);

INSERT INTO public.plans (id, name, price_monthly, price_yearly, max_customers, features, sort_order) VALUES
('free', 'Free', 0, 0, 50,
 '{"xlsx_import":true,"auto_notify":true,"payment_page":true,"unlimited_customers":false,"priority_support":false,"advanced_reports":false,"custom_messages":false,"multi_whatsapp":false,"api_access":false}'::jsonb, 1),
('pro', 'Pro', 47.00, 444.00, 500,
 '{"xlsx_import":true,"auto_notify":true,"payment_page":true,"unlimited_customers":false,"priority_support":true,"advanced_reports":true,"custom_messages":true,"multi_whatsapp":false,"api_access":false}'::jsonb, 2),
('business', 'Business', 97.00, 924.00, NULL,
 '{"xlsx_import":true,"auto_notify":true,"payment_page":true,"unlimited_customers":true,"priority_support":true,"advanced_reports":true,"custom_messages":true,"multi_whatsapp":true,"api_access":true}'::jsonb, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_customers = EXCLUDED.max_customers,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  active = true;

-- 3) Tabela de pagamentos da plataforma
CREATE TABLE IF NOT EXISTS public.plan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  asaas_payment_id text,
  pix_emv_payload text,
  pix_qrcode_image text,
  paid_at timestamptz,
  expires_at timestamptz,
  raw_webhook jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_payments_tenant_idx ON public.plan_payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS plan_payments_asaas_idx ON public.plan_payments(asaas_payment_id);

ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant reads own plan_payments" ON public.plan_payments;
CREATE POLICY "tenant reads own plan_payments"
  ON public.plan_payments FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "deny direct insert plan_payments" ON public.plan_payments;
CREATE POLICY "deny direct insert plan_payments"
  ON public.plan_payments FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny direct update plan_payments" ON public.plan_payments;
CREATE POLICY "deny direct update plan_payments"
  ON public.plan_payments FOR UPDATE
  TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny direct delete plan_payments" ON public.plan_payments;
CREATE POLICY "deny direct delete plan_payments"
  ON public.plan_payments FOR DELETE
  TO authenticated, anon
  USING (false);

DROP TRIGGER IF EXISTS plan_payments_updated_at ON public.plan_payments;
CREATE TRIGGER plan_payments_updated_at
  BEFORE UPDATE ON public.plan_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4) Status do plano da revenda atual
CREATE OR REPLACE FUNCTION public.get_my_plan_status()
RETURNS TABLE(
  plan_id text,
  plan_name text,
  price_monthly numeric,
  price_yearly numeric,
  max_customers integer,
  features jsonb,
  customer_count bigint,
  plan_expires_at timestamptz,
  is_expired boolean,
  usage_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(t.plan, 'free') AS plan_id,
    p.name AS plan_name,
    p.price_monthly,
    p.price_yearly,
    p.max_customers,
    p.features,
    (SELECT count(*)::bigint FROM public.customers c
      WHERE c.tenant_id = t.id AND COALESCE(c.status,'active') <> 'cancelled') AS customer_count,
    t.plan_expires_at,
    (t.plan_expires_at IS NOT NULL AND t.plan_expires_at < now() AND COALESCE(t.plan,'free') <> 'free') AS is_expired,
    CASE
      WHEN p.max_customers IS NULL OR p.max_customers = 0 THEN 0
      ELSE round(
        ((SELECT count(*)::numeric FROM public.customers c
            WHERE c.tenant_id = t.id AND COALESCE(c.status,'active') <> 'cancelled')
         / p.max_customers::numeric) * 100, 1)
    END AS usage_pct
  FROM public.tenants t
  JOIN public.plans p ON p.id = COALESCE(t.plan, 'free')
  WHERE t.user_id = auth.uid()
  LIMIT 1;
$$;

-- 5) Iniciar checkout: cria/atualiza registro pendente e devolve dados
CREATE OR REPLACE FUNCTION public.start_plan_checkout(_plan_id text, _billing_cycle text)
RETURNS TABLE(
  payment_id uuid,
  tenant_id uuid,
  plan_payment_token uuid,
  plan_id text,
  plan_name text,
  billing_cycle text,
  amount numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _token uuid;
  _amount numeric;
  _plan_name text;
  _payment_id uuid;
BEGIN
  IF _plan_id NOT IN ('pro','business') THEN
    RAISE EXCEPTION 'Plano inválido';
  END IF;
  IF _billing_cycle NOT IN ('monthly','yearly') THEN
    RAISE EXCEPTION 'Ciclo inválido';
  END IF;

  SELECT id, plan_payment_token INTO _tenant_id, _token
  FROM public.tenants WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'Revenda não encontrada'; END IF;

  IF _token IS NULL THEN
    _token := gen_random_uuid();
    UPDATE public.tenants SET plan_payment_token = _token WHERE id = _tenant_id;
  END IF;

  SELECT name, CASE WHEN _billing_cycle = 'yearly' THEN price_yearly ELSE price_monthly END
    INTO _plan_name, _amount
  FROM public.plans WHERE id = _plan_id;

  INSERT INTO public.plan_payments (tenant_id, plan_id, billing_cycle, amount, status)
  VALUES (_tenant_id, _plan_id, _billing_cycle, _amount, 'pending')
  RETURNING id INTO _payment_id;

  RETURN QUERY SELECT _payment_id, _tenant_id, _token, _plan_id, _plan_name, _billing_cycle, _amount;
END;
$$;

-- 6) Anexar dados do PIX ao pagamento pendente (chamado pelo server fn da plataforma)
CREATE OR REPLACE FUNCTION public.attach_plan_pix(
  _payment_id uuid, _asaas_payment_id text, _pix_emv text, _pix_image text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.plan_payments
     SET asaas_payment_id = _asaas_payment_id,
         pix_emv_payload  = _pix_emv,
         pix_qrcode_image = _pix_image,
         updated_at       = now()
   WHERE id = _payment_id;
END;
$$;

-- 7) Confirmar pagamento (usado pelo webhook com service role)
CREATE OR REPLACE FUNCTION public.confirm_plan_payment(
  _asaas_payment_id text, _amount numeric, _raw jsonb
) RETURNS TABLE(tenant_id uuid, plan_id text, expires_at timestamptz, tenant_whatsapp text, tenant_company text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pp public.plan_payments;
  _new_expires timestamptz;
  _max int;
BEGIN
  SELECT * INTO _pp FROM public.plan_payments
   WHERE asaas_payment_id = _asaas_payment_id LIMIT 1;
  IF _pp.id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;

  IF _pp.status = 'paid' THEN
    SELECT t.whatsapp, t.company_name INTO tenant_whatsapp, tenant_company
      FROM public.tenants t WHERE t.id = _pp.tenant_id;
    RETURN QUERY SELECT _pp.tenant_id, _pp.plan_id, _pp.expires_at, tenant_whatsapp, tenant_company;
    RETURN;
  END IF;

  _new_expires := CASE WHEN _pp.billing_cycle = 'yearly'
                       THEN now() + interval '365 days'
                       ELSE now() + interval '30 days' END;

  UPDATE public.plan_payments
     SET status = 'paid', paid_at = now(), expires_at = _new_expires,
         amount = COALESCE(_amount, amount), raw_webhook = _raw, updated_at = now()
   WHERE id = _pp.id;

  SELECT max_customers INTO _max FROM public.plans WHERE id = _pp.plan_id;

  UPDATE public.tenants
     SET plan = _pp.plan_id,
         max_customers = COALESCE(_max, 999999),
         plan_expires_at = _new_expires,
         updated_at = now()
   WHERE id = _pp.tenant_id;

  SELECT t.whatsapp, t.company_name INTO tenant_whatsapp, tenant_company
    FROM public.tenants t WHERE t.id = _pp.tenant_id;
  RETURN QUERY SELECT _pp.tenant_id, _pp.plan_id, _new_expires, tenant_whatsapp, tenant_company;
END;
$$;

-- 8) Verificar status de um pagamento (polling do checkout)
CREATE OR REPLACE FUNCTION public.get_plan_payment_status(_payment_id uuid)
RETURNS TABLE(status text, plan_id text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.status, pp.plan_id, pp.expires_at
    FROM public.plan_payments pp
    JOIN public.tenants t ON t.id = pp.tenant_id
   WHERE pp.id = _payment_id AND t.user_id = auth.uid()
   LIMIT 1;
$$;

-- 9) Expira planos vencidos -> volta para free
CREATE OR REPLACE FUNCTION public.expire_overdue_plans()
RETURNS TABLE(tenant_id uuid, previous_plan text, whatsapp text, company_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE public.tenants t
       SET plan = 'free', max_customers = 50, updated_at = now()
     WHERE t.plan_expires_at IS NOT NULL
       AND t.plan_expires_at < now()
       AND COALESCE(t.plan,'free') <> 'free'
    RETURNING t.id, t.plan AS new_plan, t.whatsapp, t.company_name
  )
  SELECT e.id, 'expired'::text, e.whatsapp, e.company_name FROM expired e;
END;
$$;

-- 10) Lista tenants com plano vencendo em N dias (para aviso)
CREATE OR REPLACE FUNCTION public.get_tenants_plan_expiring(_days integer DEFAULT 3)
RETURNS TABLE(tenant_id uuid, plan_id text, plan_name text, expires_at timestamptz, whatsapp text, company_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.plan, p.name, t.plan_expires_at, t.whatsapp, t.company_name
    FROM public.tenants t
    JOIN public.plans p ON p.id = t.plan
   WHERE t.plan_expires_at IS NOT NULL
     AND t.plan <> 'free'
     AND t.plan_expires_at > now()
     AND t.plan_expires_at <= now() + (_days || ' days')::interval;
$$;
