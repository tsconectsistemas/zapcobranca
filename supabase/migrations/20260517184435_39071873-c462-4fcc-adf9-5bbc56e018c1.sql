-- Drop all versions of the function to clean up potential conflicts
DROP FUNCTION IF EXISTS public.update_tenant_secrets(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_tenant_secrets(text, text, text, text, text, integer);

-- Create a single, robust version of the function
CREATE OR REPLACE FUNCTION public.update_tenant_secrets(
  _asaas_api_key text DEFAULT NULL,
  _asaas_environment text DEFAULT NULL,
  _evolution_api_url text DEFAULT NULL,
  _evolution_api_key text DEFAULT NULL,
  _asaas_webhook_token text DEFAULT NULL,
  _pix_expiration_minutes integer DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  -- Get tenant_id for the current authenticated user
  SELECT id INTO _tenant_id FROM public.tenants WHERE user_id = auth.uid();
  
  IF _tenant_id IS NULL THEN 
    RAISE EXCEPTION 'Revenda não encontrada'; 
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
