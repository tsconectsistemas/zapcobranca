-- Global settings table (admin only)
create table if not exists public.global_settings (
  id text primary key,
  value text,
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references public.admin_users(id)
);

-- Enable RLS
alter table public.global_settings
  enable row level security;

-- Admin-only access policy (assuming is_admin() function exists as per earlier context)
create policy "admin_manages_global_settings"
  on public.global_settings for all
  using (public.is_admin());

-- Insert default global settings
insert into public.global_settings (id, value, description)
values
('evolution_api_url', '', 'URL base da Evolution API — compartilhada por todas as revendas'),
('evolution_api_key', '', 'API Key global da Evolution API'),
('app_url', 'https://zapcobranca.com.br', 'URL pública do sistema (usada nos links de pagamento)')
on conflict (id) do nothing;

-- Function for edge functions to read global settings securely
create or replace function public.get_global_setting(setting_key text)
returns text as $$
  select value from public.global_settings where id = setting_key;
$$ language sql security definer;

-- Add Asaas columns to tenants (reseller specific)
alter table public.tenants
  add column if not exists asaas_api_key text,
  add column if not exists asaas_environment text default 'production';

-- Remove Evolution API columns from tenants (no longer needed per tenant)
alter table public.tenants
  drop column if exists evolution_api_url,
  drop column if exists evolution_api_key;
