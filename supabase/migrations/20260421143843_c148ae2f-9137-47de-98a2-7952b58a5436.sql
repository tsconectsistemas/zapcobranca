create or replace function public.get_dashboard_metrics()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p_tenant_id uuid;
  today date := current_date;
  result json;
begin
  p_tenant_id := public.current_tenant_id();
  if p_tenant_id is null then
    return json_build_object(
      'total_customers', 0,
      'active_customers', 0,
      'expiring_today', 0,
      'expiring_3days', 0,
      'overdue_customers', 0,
      'revenue_this_month', 0,
      'revenue_last_month', 0,
      'payments_today', 0,
      'notifications_today', 0
    );
  end if;

  select json_build_object(
    'total_customers',
      (select count(*) from customers
       where tenant_id = p_tenant_id
       and coalesce(status, 'active') <> 'cancelled'),
    'active_customers',
      (select count(*) from customers
       where tenant_id = p_tenant_id
       and status = 'active'
       and expiration_date >= today),
    'expiring_today',
      (select count(*) from customers
       where tenant_id = p_tenant_id
       and expiration_date = today
       and status = 'active'),
    'expiring_3days',
      (select count(*) from customers
       where tenant_id = p_tenant_id
       and expiration_date between today and today + 3
       and status = 'active'),
    'overdue_customers',
      (select count(*) from customers
       where tenant_id = p_tenant_id
       and expiration_date < today
       and coalesce(status, 'active') <> 'cancelled'),
    'revenue_this_month',
      (select coalesce(sum(amount), 0) from payments
       where tenant_id = p_tenant_id
       and paid_at >= date_trunc('month', now())),
    'revenue_last_month',
      (select coalesce(sum(amount), 0) from payments
       where tenant_id = p_tenant_id
       and paid_at >= date_trunc('month', now()) - interval '1 month'
       and paid_at < date_trunc('month', now())),
    'payments_today',
      (select count(*) from payments
       where tenant_id = p_tenant_id
       and paid_at >= today),
    'notifications_today',
      (select count(*) from notifications
       where tenant_id = p_tenant_id
       and sent_at >= today
       and success = true)
  ) into result;

  return result;
end;
$$;

create or replace function public.get_expiration_timeline()
returns table(expiration_date date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.expiration_date, count(*)::bigint
  from customers c
  where c.tenant_id = public.current_tenant_id()
    and c.expiration_date between current_date and current_date + 30
    and c.status = 'active'
  group by c.expiration_date
  order by c.expiration_date;
$$;