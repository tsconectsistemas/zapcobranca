-- Drop functions with their full signatures
DROP FUNCTION IF EXISTS public.get_tenant_secrets(uuid);
DROP FUNCTION IF EXISTS public.update_tenant_secrets(text, text, text, text, text);

-- Recreate get_tenant_secrets
CREATE OR REPLACE FUNCTION public.get_tenant_secrets(_tenant_id uuid)
 RETURNS TABLE(
    asaas_api_key text, 
    asaas_environment text, 
    evolution_api_url text, 
    evolution_instance text, 
    evolution_api_key text, 
    asaas_webhook_token text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select asaas_api_key, asaas_environment,
         evolution_api_url, evolution_instance, evolution_api_key, asaas_webhook_token
  from public.tenant_secrets
  where tenant_id = _tenant_id;
$function$;

-- Recreate update_tenant_secrets
CREATE OR REPLACE FUNCTION public.update_tenant_secrets(
    _asaas_api_key text DEFAULT NULL,
    _asaas_environment text DEFAULT NULL,
    _evolution_api_url text DEFAULT NULL,
    _evolution_api_key text DEFAULT NULL,
    _asaas_webhook_token text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    updated_at
  )
  VALUES (
    _tenant_id, 
    _asaas_api_key, 
    _asaas_environment, 
    _evolution_api_url, 
    _evolution_api_key,
    _asaas_webhook_token,
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    asaas_api_key = COALESCE(_asaas_api_key, tenant_secrets.asaas_api_key),
    asaas_environment = COALESCE(_asaas_environment, tenant_secrets.asaas_environment),
    evolution_api_url = COALESCE(_evolution_api_url, tenant_secrets.evolution_api_url),
    evolution_api_key = COALESCE(_evolution_api_key, tenant_secrets.evolution_api_key),
    asaas_webhook_token = COALESCE(_asaas_webhook_token, tenant_secrets.asaas_webhook_token),
    updated_at = now();
END;
$function$;
