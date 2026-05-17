-- Admin users table (separate from tenants)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  name text not null,
  email text not null unique,
  role text default 'admin',
  active boolean default true,
  last_login timestamptz,
  created_at timestamptz default now()
);

-- Plans management table (editable by admin)
create table if not exists public.saas_plans (
  id text primary key,
  name text not null,
  description text,
  price_monthly numeric(10,2) not null default 0,
  price_yearly numeric(10,2),
  max_customers integer,
  features jsonb default '[]'::jsonb,
  is_active boolean default true,
  is_featured boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default plans
insert into public.saas_plans (id, name, description, price_monthly, price_yearly, max_customers, features, is_active, is_featured, sort_order, created_at, updated_at) values
('free', 'Free', 'Para começar a testar', 
 0, 0, 50,
 '["Até 50 clientes","Importação XLSX","Notificações automáticas","Página de pagamento PIX"]'::jsonb,
 true, false, 1, now(), now()),
('pro', 'Pro', 'Para revendas em crescimento',
 47.00, 37.00, 500,
 '["Até 500 clientes","Tudo do Free","Suporte prioritário","Relatórios avançados","Mensagens personalizadas"]'::jsonb,
 true, true, 2, now(), now()),
('business', 'Business', 'Para grandes revendas',
 97.00, 77.00, null,
 '["Clientes ilimitados","Tudo do Pro","Multi-WhatsApp","Acesso à API","Onboarding incluso"]'::jsonb,
 true, false, 3, now(), now())
on conflict (id) do nothing;

-- Vouchers / discount codes table
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  discount_type text not null default 'percent',
  discount_value numeric(10,2) not null,
  plan_id text references public.saas_plans(id),
  max_uses integer,
  current_uses integer default 0,
  valid_from timestamptz default now(),
  valid_until timestamptz,
  active boolean default true,
  created_by uuid references public.admin_users(id),
  created_at timestamptz default now()
);

-- Voucher usage log
create table if not exists public.voucher_uses (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references public.vouchers(id),
  tenant_id uuid references public.tenants(id),
  used_at timestamptz default now(),
  discount_applied numeric(10,2)
);

-- Landing page content (editable by admin)
create table if not exists public.landing_content (
  id text primary key,
  section text not null,
  content jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references public.admin_users(id)
);

-- Insert default landing page content
insert into public.landing_content (id, section, content, updated_at, updated_by) values
('hero', 'hero', '{
  "title": "Gerencie cobranças IPTV no piloto automático",
  "subtitle": "Notificações automáticas via WhatsApp, PIX integrado e gestão completa de assinantes para revendas IPTV.",
  "cta_primary": "Começar grátis",
  "cta_secondary": "Ver planos",
  "badge": "Novo: Notificações D+7 disponíveis"
}'::jsonb, now(), null),
('features', 'features', '{
  "title": "Tudo que sua revenda precisa",
  "items": [
    {"icon": "zap", "title": "Notificações automáticas", "desc": "WhatsApp automático em D-3, D-1, D-0 e pós-vencimento"},
    {"icon": "qr-code", "title": "PIX com QR Code", "desc": "Gera QR Code com valor para cada cliente automaticamente"},
    {"icon": "users", "title": "Multi-tenant", "desc": "Cada revenda tem seu ambiente isolado e seguro"},
    {"icon": "bar-chart", "title": "Dashboard completo", "desc": "Métricas de receita, inadimplência e vencimentos"},
    {"icon": "upload", "title": "Importação XLSX", "desc": "Importe todos os clientes do seu painel IPTV de uma vez"},
    {"icon": "shield", "title": "Seguro e confiável", "desc": "Dados isolados por revenda com criptografia total"}
  ]
}'::jsonb, now(), null),
('stats', 'stats', '{
  "items": [
    {"value": "500+", "label": "Revendas ativas"},
    {"value": "50k+", "label": "Clientes gerenciados"},
    {"value": "98%", "label": "Taxa de entrega"},
    {"value": "R$2M+", "label": "Cobranças processadas"}
  ]
}'::jsonb, now(), null)
on conflict (id) do nothing;

-- Admin audit log
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_users(id),
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- RLS: admin tables only accessible by admin users
alter table public.admin_users enable row level security;
alter table public.saas_plans enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_uses enable row level security;
alter table public.landing_content enable row level security;
alter table public.admin_logs enable row level security;

-- Helper function to check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
    and active = true
  );
$$ language sql security definer;

-- Admin policies
create policy "admin_users_select" on public.admin_users
  for select using (public.is_admin());

create policy "saas_plans_select_public" on public.saas_plans
  for select using (true);

create policy "saas_plans_all_admin" on public.saas_plans
  for all using (public.is_admin());

create policy "vouchers_all_admin" on public.vouchers
  for all using (public.is_admin());

create policy "voucher_uses_all_admin" on public.voucher_uses
  for all using (public.is_admin());

create policy "landing_content_select_public" on public.landing_content
  for select using (true);

create policy "landing_content_all_admin" on public.landing_content
  for all using (public.is_admin());

create policy "admin_logs_admin" on public.admin_logs
  for all using (public.is_admin());

-- Allow admin to read ALL tenants (bypass tenant RLS)
create policy "admin_reads_all_tenants" on public.tenants
  for select using (public.is_admin());

create policy "admin_updates_all_tenants" on public.tenants
  for update using (public.is_admin());

create policy "admin_reads_all_customers" on public.customers
  for select using (public.is_admin());

create policy "admin_reads_all_payments" on public.payments
  for select using (public.is_admin());

create policy "admin_reads_all_notifications" on public.notifications
  for select using (public.is_admin());

-- Global metrics function for admin dashboard
create or replace function public.get_admin_metrics()
returns json as $$
declare
  result json;
begin
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
$$ language plpgsql security definer;