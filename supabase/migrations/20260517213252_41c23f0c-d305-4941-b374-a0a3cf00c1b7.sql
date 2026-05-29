-- Otimiza a listagem de revendas com contagem de clientes agregada
CREATE OR REPLACE FUNCTION public.get_admin_tenants()
RETURNS TABLE (
    id UUID,
    company_name TEXT,
    email TEXT,
    plan TEXT,
    whatsapp TEXT,
    active BOOLEAN,
    created_at TIMESTAMPTZ,
    max_customers INTEGER,
    customers_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verifica se o usuário é admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT 
        t.id,
        t.company_name,
        t.email,
        t.plan,
        t.whatsapp,
        t.active,
        t.created_at,
        t.max_customers,
        COUNT(c.id) as customers_count
    FROM public.tenants t
    LEFT JOIN public.customers c ON c.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC;
END;
$$;

-- Refatora o dashboard para ser dinâmico e seguro
CREATE OR REPLACE FUNCTION public.get_admin_metrics()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result json;
begin
  -- Check if user is actually admin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  select json_build_object(
    'total_tenants',
      (select count(*) from public.tenants),
    'active_tenants',
      (select count(*) from public.tenants where active = true),
    'suspended_tenants',
      (select count(*) from public.tenants where active = false),
    'tenants_by_plan', (
      select json_object_agg(plan, count)
      from (
        select plan, count(*) from public.tenants
        group by plan
      ) t
    ),
    'total_customers',
      (select count(*) from public.customers),
    'active_customers',
      (select count(*) from public.customers 
       where status = 'active'),
    'total_payments_this_month',
      (select coalesce(sum(amount), 0) from public.payments
       where paid_at >= date_trunc('month', now())),
    'total_payments_last_month',
      (select coalesce(sum(amount), 0) from public.payments
       where paid_at >= date_trunc('month', now()) - interval '1 month'
       and paid_at < date_trunc('month', now())),
    'total_notifications_today',
      (select count(*) from public.notifications
       where sent_at >= current_date),
    'notifications_success_rate', (
      select round(
        (100.0 * count(*) filter (where success = true))
        / nullif(count(*), 0), 1
      )
      from public.notifications
      where sent_at >= current_date - interval '7 days'
    ),
    'new_tenants_this_month',
      (select count(*) from public.tenants
       where created_at >= date_trunc('month', now())),
    'new_tenants_last_month',
      (select count(*) from public.tenants
       where created_at >= date_trunc('month', now()) - interval '1 month'
       and created_at < date_trunc('month', now())),
    'mrr', (
      -- MRR Dinâmico baseado nos preços da tabela plans
      select coalesce(sum(
        case 
          when t.plan = 'pro' then (select price_monthly from public.plans where id = 'pro' or name ilike '%pro%' limit 1)
          when t.plan = 'business' then (select price_monthly from public.plans where id = 'business' or name ilike '%business%' limit 1)
          else 0
        end
      ), 0)
      from public.tenants t
      where t.active = true
    )
  ) into result;
  return result;
end;
$function$;

-- Adiciona índices para acelerar buscas comuns
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON public.notifications(sent_at);
