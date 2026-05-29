create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove existing job if present, so this migration is idempotent
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-expiration-notifications') then
    perform cron.unschedule('daily-expiration-notifications');
  end if;
end $$;