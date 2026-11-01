-- Free web-service hosts sleep an idle worker. When a keep-alive URL is set,
-- ping it on the reconciliation cadence so queued imports keep being processed.
create extension if not exists pg_net with schema extensions;
create table if not exists private.worker_settings (
  id boolean primary key default true check (id),
  keepalive_url text check (keepalive_url is null or keepalive_url like 'https://%')
);
create or replace function public.ping_worker() returns void language plpgsql security definer set search_path='' as $$
declare target text; begin
  select keepalive_url into target from private.worker_settings where id;
  if target is not null then perform net.http_get(url := target, timeout_milliseconds := 5000); end if;
end; $$;
revoke all on function public.ping_worker() from public, anon, authenticated;
grant execute on function public.ping_worker() to service_role;
select cron.schedule('devsync-worker-keepalive', '*/10 * * * *', 'select public.ping_worker()');
