ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS external_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS external_webhook_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS external_webhook_secret TEXT;

DROP FUNCTION IF EXISTS public.get_tenant_secrets(UUID);

CREATE OR REPLACE FUNCTION public.get_tenant_secrets(_tenant_id UUID)
RETURNS TABLE (
  asaas_api_key TEXT,
  asaas_environment TEXT,
  asaas_webhook_token TEXT,
  evolution_api_url TEXT,
  evolution_api_key TEXT,
  external_webhook_url TEXT,
  external_webhook_enabled BOOLEAN,
  external_webhook_secret TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.asaas_api_key, 
    s.asaas_environment, 
    s.asaas_webhook_token,
    s.evolution_api_url,
    s.evolution_api_key,
    t.external_webhook_url,
    t.external_webhook_enabled,
    t.external_webhook_secret
  FROM public.tenant_secrets s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE s.tenant_id = _tenant_id;
END;
$$;
