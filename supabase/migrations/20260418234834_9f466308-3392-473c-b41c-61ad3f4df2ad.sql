-- Replace permissive row-level UPDATE with column-level grants
drop policy if exists "tenant can update own data" on public.tenants;

create policy "tenant can update own profile fields"
  on public.tenants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Revoke broad UPDATE and grant only specific columns to authenticated
revoke update on public.tenants from authenticated;
grant update (company_name, email, whatsapp) on public.tenants to authenticated;

-- Ensure SELECT/INSERT/DELETE table privileges remain (RLS still gates rows)
grant select, insert, delete on public.tenants to authenticated;