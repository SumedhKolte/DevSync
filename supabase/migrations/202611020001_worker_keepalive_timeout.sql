-- A sleeping free worker can take up to a minute to start. Wait long enough
-- for the wake-up request to complete; pg_net requests are asynchronous.
create or replace function public.ping_worker() returns void language plpgsql security definer set search_path='' as $$
declare target text; begin
  select keepalive_url into target from private.worker_settings where id;
  if target is not null then perform net.http_get(url := target, timeout_milliseconds := 60000); end if;
end; $$;
