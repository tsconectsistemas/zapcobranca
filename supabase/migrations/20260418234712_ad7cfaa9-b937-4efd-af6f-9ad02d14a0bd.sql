-- =====================
-- TABLE: tenant_secrets (isolated credentials)
-- =====================
create table public.tenant_secrets (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  asaas_api_key text,
  asaas_environment text default 'sandbox',
  evolution_api_url text,
  evolution_instance text,
  evolution_api_key text,
  updated_at timestamptz default now()
);

alter table public.tenant_secrets enable row level security;

-- Migrate existing data (idempotent — empty tables on fresh install)
insert into public.tenant_secrets (
  tenant_id, asaas_api_key, asaas_environment,
  evolution_api_url, evolution_instance, evolution_api_key
)
select id, asaas_api_key, asaas_environment,
       evolution_api_url, evolution_instance, evolution_api_key
from public.tenants
on conflict (tenant_id) do nothing;

-- Drop sensitive columns from tenants
alter table public.tenants drop column asaas_api_key;
alter table public.tenants drop column asaas_environment;
alter table public.tenants drop column evolution_api_url;
alter table public.tenants drop column evolution_instance;
alter table public.tenants drop column evolution_api_key;

-- =====================
-- RLS for tenant_secrets: deny ALL direct client access
-- Backend uses SECURITY DEFINER functions or service role
-- =====================
create policy "deny direct select on secrets"
  on public.tenant_secrets for select
  using (false);

create policy "deny direct insert on secrets"
  on public.tenant_secrets for insert
  with check (false);

create policy "deny direct update on secrets"
  on public.tenant_secrets for update
  using (false);

create policy "deny direct delete on secrets"
  on public.tenant_secrets for delete
  using (false);

-- =====================
-- Backend-only function to read secrets (used by edge functions / service role)
-- =====================
create or replace function public.get_tenant_secrets(_tenant_id uuid)
returns table (
  asaas_api_key text,
  asaas_environment text,
  evolution_api_url text,
  evolution_instance text,
  evolution_api_key text
)
language sql
stable
security definer
set search_path = public
as $$
  select asaas_api_key, asaas_environment,
         evolution_api_url, evolution_instance, evolution_api_key
  from public.tenant_secrets
  where tenant_id = _tenant_id;
$$;

-- Only service_role can call this — never grant to anon/authenticated
revoke execute on function public.get_tenant_secrets(uuid) from public, anon, authenticated;
grant execute on function public.get_tenant_secrets(uuid) to service_role;

-- =====================
-- Tenant-facing function to UPDATE own secrets without reading them back
-- =====================
create or replace function public.update_tenant_secrets(
  _asaas_api_key text default null,
  _asaas_environment text default null,
  _evolution_api_url text default null,
  _evolution_instance text default null,
  _evolution_api_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid;
begin
  select id into _tenant_id from public.tenants where user_id = auth.uid();
  if _tenant_id is null then
    raise exception 'No tenant found for current user';
  end if;

  insert into public.tenant_secrets (tenant_id) values (_tenant_id)
  on conflict (tenant_id) do nothing;

  update public.tenant_secrets set
    asaas_api_key      = coalesce(_asaas_api_key, asaas_api_key),
    asaas_environment  = coalesce(_asaas_environment, asaas_environment),
    evolution_api_url  = coalesce(_evolution_api_url, evolution_api_url),
    evolution_instance = coalesce(_evolution_instance, evolution_instance),
    evolution_api_key  = coalesce(_evolution_api_key, evolution_api_key),
    updated_at         = now()
  where tenant_id = _tenant_id;
end;
$$;

revoke execute on function public.update_tenant_secrets(text, text, text, text, text) from public, anon;
grant execute on function public.update_tenant_secrets(text, text, text, text, text) to authenticated;

-- =====================
-- Tenant-facing function to check WHICH secrets are configured (booleans only — never values)
-- =====================
create or replace function public.get_tenant_secrets_status()
returns table (
  has_asaas_key boolean,
  asaas_environment text,
  has_evolution_url boolean,
  has_evolution_instance boolean,
  has_evolution_key boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (s.asaas_api_key is not null and s.asaas_api_key <> '') as has_asaas_key,
    s.asaas_environment,
    (s.evolution_api_url is not null and s.evolution_api_url <> '') as has_evolution_url,
    (s.evolution_instance is not null and s.evolution_instance <> '') as has_evolution_instance,
    (s.evolution_api_key is not null and s.evolution_api_key <> '') as has_evolution_key
  from public.tenant_secrets s
  join public.tenants t on t.id = s.tenant_id
  where t.user_id = auth.uid();
$$;

revoke execute on function public.get_tenant_secrets_status() from public, anon;
grant execute on function public.get_tenant_secrets_status() to authenticated;

-- =====================
-- Add missing DELETE policy on tenants
-- =====================
create policy "tenant can delete own data"
  on public.tenants for delete
  to authenticated
  using (user_id = auth.uid());

-- Trigger for tenant_secrets updated_at
create trigger trg_tenant_secrets_updated_at
  before update on public.tenant_secrets
  for each row execute function public.update_updated_at();