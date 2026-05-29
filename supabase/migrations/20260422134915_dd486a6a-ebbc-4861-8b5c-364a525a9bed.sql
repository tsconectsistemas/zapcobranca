ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS notification_settings jsonb NOT NULL DEFAULT jsonb_build_object(
  'd3', true,
  'd1', true,
  'd0', true,
  'confirmed', true,
  'send_hour', 9
);

UPDATE public.tenants
SET notification_settings = jsonb_build_object(
  'd3', true,
  'd1', true,
  'd0', true,
  'confirmed', true,
  'send_hour', 9
)
WHERE notification_settings IS NULL;

CREATE OR REPLACE FUNCTION public.get_my_settings()
RETURNS TABLE (
  company_name text,
  email text,
  whatsapp text,
  logo_url text,
  plan text,
  max_customers integer,
  active boolean,
  notification_settings jsonb,
  asaas_environment text,
  has_asaas_key boolean,
  evolution_api_url text,
  has_evolution_key boolean,
  evolution_instance text,
  whatsapp_status text,
  whatsapp_connected_at timestamptz,
  customer_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.company_name,
    t.email,
    t.whatsapp,
    t.logo_url,
    t.plan,
    t.max_customers,
    t.active,
    COALESCE(
      t.notification_settings,
      jsonb_build_object(
        'd3', true,
        'd1', true,
        'd0', true,
        'confirmed', true,
        'send_hour', 9
      )
    ) AS notification_settings,
    ts.asaas_environment,
    COALESCE(ts.asaas_api_key IS NOT NULL AND ts.asaas_api_key <> '', false) AS has_asaas_key,
    ts.evolution_api_url,
    COALESCE(ts.evolution_api_key IS NOT NULL AND ts.evolution_api_key <> '', false) AS has_evolution_key,
    ts.evolution_instance,
    COALESCE(ws.status, 'disconnected') AS whatsapp_status,
    ws.connected_at AS whatsapp_connected_at,
    (
      SELECT count(*)::bigint
      FROM public.customers c
      WHERE c.tenant_id = t.id
        AND COALESCE(c.status, 'active') <> 'cancelled'
    ) AS customer_count
  FROM public.tenants t
  LEFT JOIN public.tenant_secrets ts ON ts.tenant_id = t.id
  LEFT JOIN public.whatsapp_sessions ws ON ws.tenant_id = t.id
  WHERE t.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_my_notification_settings(
  _d3 boolean,
  _d1 boolean,
  _d0 boolean,
  _confirmed boolean,
  _send_hour integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  IF _send_hour NOT IN (7, 8, 9, 10) THEN
    RAISE EXCEPTION 'Horário inválido';
  END IF;

  SELECT id INTO _tenant_id
  FROM public.tenants
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Revenda não encontrada';
  END IF;

  UPDATE public.tenants
  SET notification_settings = jsonb_build_object(
    'd3', COALESCE(_d3, true),
    'd1', COALESCE(_d1, true),
    'd0', COALESCE(_d0, true),
    'confirmed', COALESCE(_confirmed, true),
    'send_hour', _send_hour
  ),
  updated_at = now()
  WHERE id = _tenant_id;
END;
$$;