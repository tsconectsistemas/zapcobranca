-- =====================
-- TABLE: tenants
-- =====================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  company_name text not null,
  email text not null,
  whatsapp text,
  asaas_api_key text,
  asaas_environment text default 'sandbox',
  evolution_api_url text,
  evolution_instance text,
  evolution_api_key text,
  plan text default 'free',
  max_customers integer default 50,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- TABLE: customers
-- =====================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text,
  username text not null,
  password_iptv text,
  whatsapp text,
  pix_emv_payload text,
  monthly_value numeric(10,2),
  screens integer default 1,
  plan text,
  status text default 'active',
  expiration_date date,
  iptv_created_at timestamptz,
  last_access timestamptz,
  reseller_tag text,
  notes text,
  payment_token uuid default gen_random_uuid() unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint customers_tenant_username_unique unique (tenant_id, username)
);

-- =====================
-- TABLE: payments
-- =====================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete cascade not null,
  asaas_payment_id text,
  asaas_pix_key text,
  amount numeric(10,2),
  paid_at timestamptz,
  previous_expiration date,
  new_expiration date,
  raw_webhook jsonb,
  created_at timestamptz default now()
);

-- =====================
-- TABLE: notifications
-- =====================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete cascade not null,
  type text not null,
  message text,
  whatsapp_number text,
  sent_at timestamptz default now(),
  success boolean default true,
  error_message text
);

-- =====================
-- TABLE: whatsapp_sessions
-- =====================
create table public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade unique not null,
  instance_name text,
  status text default 'disconnected',
  qr_code text,
  connected_at timestamptz,
  updated_at timestamptz default now()
);

-- =====================
-- RLS: enable on all tables
-- =====================
alter table public.tenants enable row level security;
alter table public.customers enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.whatsapp_sessions enable row level security;

-- =====================
-- Helper function: current tenant id (SECURITY DEFINER avoids RLS recursion)
-- =====================
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tenants where user_id = auth.uid() limit 1;
$$;

-- =====================
-- RLS POLICIES: tenants
-- =====================
create policy "tenant can read own data"
  on public.tenants for select
  to authenticated
  using (user_id = auth.uid());

create policy "tenant can insert own data"
  on public.tenants for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "tenant can update own data"
  on public.tenants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================
-- RLS POLICIES: customers (no public policy — public payment page uses SECURITY DEFINER function)
-- =====================
create policy "tenant reads own customers"
  on public.customers for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "tenant inserts own customers"
  on public.customers for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy "tenant updates own customers"
  on public.customers for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant deletes own customers"
  on public.customers for delete
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- =====================
-- RLS POLICIES: payments
-- =====================
create policy "tenant reads own payments"
  on public.payments for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "tenant inserts own payments"
  on public.payments for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

-- =====================
-- RLS POLICIES: notifications
-- =====================
create policy "tenant reads own notifications"
  on public.notifications for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "tenant inserts own notifications"
  on public.notifications for insert
  to authenticated
  with check (tenant_id = public.current_tenant_id());

-- =====================
-- RLS POLICIES: whatsapp_sessions
-- =====================
create policy "tenant manages own whatsapp session"
  on public.whatsapp_sessions for all
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =====================
-- SECURITY DEFINER function: public payment page lookup
-- Returns ONLY safe public fields for /pagar/[token]
-- Never exposes password_iptv, notes, asaas keys, etc.
-- =====================
create or replace function public.get_public_payment_info(_token uuid)
returns table (
  customer_name text,
  monthly_value numeric,
  expiration_date date,
  pix_emv_payload text,
  plan text,
  company_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.name as customer_name,
    c.monthly_value,
    c.expiration_date,
    c.pix_emv_payload,
    c.plan,
    t.company_name
  from public.customers c
  join public.tenants t on t.id = c.tenant_id
  where c.payment_token = _token
  limit 1;
$$;

grant execute on function public.get_public_payment_info(uuid) to anon, authenticated;

-- =====================
-- INDEXES for performance
-- =====================
create index idx_customers_tenant_id on public.customers(tenant_id);
create index idx_customers_expiration on public.customers(expiration_date);
create index idx_customers_status on public.customers(status);
create index idx_customers_payment_token on public.customers(payment_token);
create index idx_payments_tenant_id on public.payments(tenant_id);
create index idx_payments_customer_id on public.payments(customer_id);
create index idx_notifications_tenant_id on public.notifications(tenant_id);
create index idx_notifications_customer_id on public.notifications(customer_id);

-- =====================
-- AUTO-UPDATE updated_at
-- =====================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.update_updated_at();

create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function public.update_updated_at();

create trigger trg_whatsapp_sessions_updated_at
  before update on public.whatsapp_sessions
  for each row execute function public.update_updated_at();