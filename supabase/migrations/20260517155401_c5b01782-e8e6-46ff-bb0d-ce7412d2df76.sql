-- Add pix_expiration_minutes column to tenant_secrets if it doesn't exist
ALTER TABLE public.tenant_secrets 
ADD COLUMN IF NOT EXISTS pix_expiration_minutes INTEGER DEFAULT 60;

-- Update update_tenant_secrets function to include pix_expiration_minutes
CREATE OR REPLACE FUNCTION public.update_tenant_secrets(
  _asaas_api_key text DEFAULT NULL,
  _asaas_environment text DEFAULT NULL,
  _evolution_api_url text DEFAULT NULL,
  _evolution_api_key text DEFAULT NULL,
  _asaas_webhook_token text DEFAULT NULL,
  _pix_expiration_minutes integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  SELECT id INTO _tenant_id FROM public.tenants WHERE user_id = auth.uid();
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'Revenda não encontrada'; END IF;

  INSERT INTO public.tenant_secrets (
    tenant_id, 
    asaas_api_key, 
    asaas_environment, 
    evolution_api_url, 
    evolution_api_key,
    asaas_webhook_token,
    pix_expiration_minutes,
    updated_at
  )
  VALUES (
    _tenant_id, 
    _asaas_api_key, 
    _asaas_environment, 
    _evolution_api_url, 
    _evolution_api_key,
    _asaas_webhook_token,
    COALESCE(_pix_expiration_minutes, 60),
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    asaas_api_key = COALESCE(_asaas_api_key, tenant_secrets.asaas_api_key),
    asaas_environment = COALESCE(_asaas_environment, tenant_secrets.asaas_environment),
    evolution_api_url = COALESCE(_evolution_api_url, tenant_secrets.evolution_api_url),
    evolution_api_key = COALESCE(_evolution_api_key, tenant_secrets.evolution_api_key),
    asaas_webhook_token = COALESCE(_asaas_webhook_token, tenant_secrets.asaas_webhook_token),
    pix_expiration_minutes = COALESCE(_pix_expiration_minutes, tenant_secrets.pix_expiration_minutes),
    updated_at = now();
END;
$$;

-- Update get_public_payment_info to return pix_expiration_minutes and server time
-- Casting _token to uuid to avoid comparison error
CREATE OR REPLACE FUNCTION public.get_public_payment_info(_token text)
RETURNS TABLE (
  customer_name text,
  monthly_value numeric,
  expiration_date date,
  pix_emv_payload text,
  plan text,
  company_name text,
  pix_expiration_minutes integer,
  server_time timestamptz,
  payload_updated_at timestamptz
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  select
    c.name as customer_name,
    c.monthly_value,
    c.expiration_date,
    c.pix_emv_payload,
    c.plan,
    t.company_name,
    COALESCE(s.pix_expiration_minutes, 60) as pix_expiration_minutes,
    now() as server_time,
    c.updated_at as payload_updated_at
  from public.customers c
  join public.tenants t on t.id = c.tenant_id
  left join public.tenant_secrets s on s.tenant_id = t.id
  where c.payment_token = _token::uuid
  limit 1;
$$;