-- Add notification configuration to tenants
alter table public.tenants
  add column if not exists notification_config jsonb default '{
    "enabled": true,
    "send_hour": 9,
    "before_expiration": [3, 1, 0],
    "after_expiration": [1, 3, 7],
    "templates": {
      "d3": "Olá, {nome}! 👋\n\nSua assinatura IPTV vence em *3 dias* ({vencimento}).\n\n💰 Valor: *{valor}*\n\nPague pelo link:\n{link}\n\n✅ Renovação automática de 30 dias.",
      "d1": "⚠️ Olá, {nome}!\n\nSua assinatura IPTV vence *amanhã* ({vencimento}).\n\n💰 Valor: *{valor}*\n\nRenove agora:\n{link}\n\n✅ Renovação automática de 30 dias.",
      "d0": "🚨 Olá, {nome}!\n\nSua assinatura IPTV vence *hoje*!\n\n💰 Valor: *{valor}*\n\nPague agora:\n{link}\n\n✅ Renovação automática após pagamento.",
      "overdue_1": "❌ Olá, {nome}!\n\nSua assinatura IPTV venceu *ontem*.\n\n💰 Valor: *{valor}*\n\nRegularize agora:\n{link}",
      "overdue_3": "❌ Olá, {nome}!\n\nSua assinatura IPTV está vencida há *3 dias*.\n\n💰 Valor: *{valor}*\n\nEvite perder o acesso definitivamente:\n{link}",
      "overdue_7": "🚫 Olá, {nome}!\n\nSua assinatura IPTV está vencida há *7 dias*.\n\n💰 Valor: *{valor}*\n\nÚltimo aviso antes do cancelamento:\n{link}"
    }
  }'::jsonb;

-- Notification queue table for retry logic
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  type text not null,
  message text not null,
  whatsapp_number text not null,
  status text default 'pending',
  attempts integer default 0,
  max_attempts integer default 3,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz default now(),
  error_message text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- RLS for notification_queue
alter table public.notification_queue 
  enable row level security;

-- Try to drop policy if it exists first to avoid errors on retry
do $$
begin
    if exists (select 1 from pg_policies where policyname = 'tenant reads own queue' and tablename = 'notification_queue') then
        drop policy "tenant reads own queue" on public.notification_queue;
    end if;
end
$$;

create policy "tenant reads own queue"
  on public.notification_queue for select
  using (tenant_id = (
    select id from public.tenants 
    where user_id = auth.uid()
  ));

-- Indexes
create index if not exists idx_queue_status 
  on public.notification_queue(status);
create index if not exists idx_queue_tenant 
  on public.notification_queue(tenant_id);
create index if not exists idx_queue_next_attempt 
  on public.notification_queue(next_attempt_at);
create index if not exists idx_notifications_type_date
  on public.notifications(customer_id, type, sent_at);
