-- Drop existing deny policies and recreate them targeting both anon and authenticated explicitly
drop policy if exists "deny direct select on secrets" on public.tenant_secrets;
drop policy if exists "deny direct insert on secrets" on public.tenant_secrets;
drop policy if exists "deny direct update on secrets" on public.tenant_secrets;
drop policy if exists "deny direct delete on secrets" on public.tenant_secrets;

create policy "deny direct select on secrets"
  on public.tenant_secrets for select
  to anon, authenticated
  using (false);

create policy "deny direct insert on secrets"
  on public.tenant_secrets for insert
  to anon, authenticated
  with check (false);

create policy "deny direct update on secrets"
  on public.tenant_secrets for update
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny direct delete on secrets"
  on public.tenant_secrets for delete
  to anon, authenticated
  using (false);