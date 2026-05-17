-- Update is_admin with search_path and restricted execution
create or replace function public.is_admin()
returns boolean 
language sql 
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
    and active = true
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Update get_admin_metrics with search_path and restricted execution
create or replace function public.get_admin_metrics()
returns json 
language plpgsql 
security definer
set search_path = public
as $$
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
      select coalesce(sum(
        case plan
          when 'pro' then 47.00
          when 'business' then 97.00
          else 0
        end
      ), 0)
      from public.tenants
      where active = true
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.get_admin_metrics() from public;
grant execute on function public.get_admin_metrics() to authenticated;