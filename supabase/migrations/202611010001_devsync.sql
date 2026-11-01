-- DevSync v1. Private per-authorizing-user source data; no implicit team sharing.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgmq;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'My workspace' check (length(name) between 2 and 80), created_at timestamptz not null default now()
);
create table public.connections (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, provider text not null check (provider in ('github','jira')),
  provider_account_id text not null, label text not null, config jsonb not null default '{}', resources jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending','connected','error')), last_sync_at timestamptz, last_error text,
  created_at timestamptz not null default now(), unique(workspace_id,provider), unique(id,workspace_id)
);
create table private.connection_secrets (connection_id uuid primary key references public.connections(id) on delete cascade, ciphertext text not null);
create table public.work_items (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null, provider_id text not null, issue_key text not null, title text not null,
  payload jsonb not null, updated_at timestamptz not null default now(),
  foreign key(connection_id,workspace_id) references public.connections(id,workspace_id) on delete cascade,
  unique(connection_id,provider_id), unique(id,workspace_id)
);
create table public.pull_requests (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null, provider_id text not null, repository text not null, title text not null,
  payload jsonb not null, updated_at timestamptz not null default now(),
  foreign key(connection_id,workspace_id) references public.connections(id,workspace_id) on delete cascade,
  unique(connection_id,provider_id), unique(id,workspace_id)
);
create table public.development_links (
  workspace_id uuid not null references public.workspaces(id) on delete cascade, work_item_id uuid not null,
  pull_request_id uuid not null, evidence jsonb not null,
  primary key(work_item_id,pull_request_id),
  foreign key(work_item_id,workspace_id) references public.work_items(id,workspace_id) on delete cascade,
  foreign key(pull_request_id,workspace_id) references public.pull_requests(id,workspace_id) on delete cascade
);
create table public.activity_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null, provider_id text not null, payload jsonb not null, occurred_at timestamptz not null,
  foreign key(connection_id,workspace_id) references public.connections(id,workspace_id) on delete cascade,
  unique(connection_id,provider_id)
);
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade, status text not null default 'queued',
  started_at timestamptz not null default now(), finished_at timestamptz, error text, records_count integer not null default 0
);
create table private.webhook_deliveries (
  provider text not null, delivery_id text not null, connection_id uuid not null references public.connections(id) on delete cascade,
  received_at timestamptz not null default now(), primary key(provider,delivery_id,connection_id)
);
create table private.connection_locks (connection_id uuid primary key references public.connections(id) on delete cascade, locked_until timestamptz not null, lease uuid not null);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action text not null, created_at timestamptz not null default now(), details jsonb not null default '{}'
);
create index work_items_search on public.work_items using gin(to_tsvector('english', issue_key || ' ' || title));
create index pull_requests_search on public.pull_requests using gin(to_tsvector('english', repository || ' ' || title));
create index work_items_workspace on public.work_items(workspace_id,updated_at desc);
create index pull_requests_workspace on public.pull_requests(workspace_id,updated_at desc);
create index events_workspace on public.activity_events(workspace_id,occurred_at desc);
create index connections_owner on public.connections(owner_id);

alter table public.workspaces enable row level security;
alter table public.connections enable row level security;
alter table public.work_items enable row level security;
alter table public.pull_requests enable row level security;
alter table public.development_links enable row level security;
alter table public.activity_events enable row level security;
alter table public.sync_runs enable row level security;
alter table public.audit_events enable row level security;
create policy workspace_owner_read on public.workspaces for select to authenticated using (owner_id=(select auth.uid()));
create policy workspace_owner_update on public.workspaces for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy connection_owner_read on public.connections for select to authenticated using(owner_id=(select auth.uid()));
-- App reads are fail-closed if an import/access revalidation is over 30 minutes old.
create policy item_owner_read on public.work_items for select to authenticated using(exists(select 1 from public.connections c where c.id=connection_id and c.owner_id=(select auth.uid()) and c.last_sync_at>now()-interval '30 minutes' and c.status='connected'));
create policy pr_owner_read on public.pull_requests for select to authenticated using(exists(select 1 from public.connections c where c.id=connection_id and c.owner_id=(select auth.uid()) and c.last_sync_at>now()-interval '30 minutes' and c.status='connected'));
create policy link_owner_read on public.development_links for select to authenticated using(exists(select 1 from public.work_items w where w.id=work_item_id) and exists(select 1 from public.pull_requests p where p.id=pull_request_id));
create policy event_owner_read on public.activity_events for select to authenticated using(exists(select 1 from public.connections c where c.id=connection_id and c.owner_id=(select auth.uid()) and c.last_sync_at>now()-interval '30 minutes' and c.status='connected'));
create policy sync_owner_read on public.sync_runs for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy audit_owner_read on public.audit_events for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
revoke all on all tables in schema public from anon, authenticated;
grant select on public.workspaces,public.connections,public.work_items,public.pull_requests,public.development_links,public.activity_events,public.sync_runs,public.audit_events to authenticated;
grant update(name) on public.workspaces to authenticated;

create function public.ensure_workspace() returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.workspaces(owner_id) values(auth.uid()) on conflict(owner_id) do nothing;
  select id into result from public.workspaces where owner_id=auth.uid(); return result;
end; $$;
create function public.save_connection(p_provider text,p_account_id text,p_label text,p_config jsonb,p_ciphertext text) returns uuid language plpgsql security definer set search_path='' as $$
declare wid uuid; cid uuid; begin
  wid:=public.ensure_workspace();
  insert into public.connections(workspace_id,owner_id,provider,provider_account_id,label,config) values(wid,auth.uid(),p_provider,p_account_id,p_label,p_config)
  on conflict(workspace_id,provider) do update set provider_account_id=excluded.provider_account_id,label=excluded.label,config=excluded.config,status='pending',resources='[]',last_sync_at=null,last_error=null returning id into cid;
  delete from public.work_items where connection_id=cid; delete from public.pull_requests where connection_id=cid; delete from public.activity_events where connection_id=cid;
  insert into private.connection_secrets values(cid,p_ciphertext) on conflict(connection_id) do update set ciphertext=excluded.ciphertext;
  insert into public.audit_events(workspace_id,action) values(wid,'connection.authorized'); return cid;
end; $$;
create function public.remove_connection(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.connections where id=p_id and owner_id=auth.uid()) then raise exception 'Connection not found'; end if;
  insert into public.audit_events(workspace_id,action) select workspace_id,'connection.removed' from public.connections where id=p_id;
  delete from public.connections where id=p_id and owner_id=auth.uid();
end; $$;

select pgmq.create('devsync_jobs');
create function public.enqueue_sync(p_id uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint; begin
  if not exists(select 1 from public.connections where id=p_id and (owner_id=auth.uid() or auth.role()='service_role')) then raise exception 'Connection not found'; end if;
  select pgmq.send('devsync_jobs',jsonb_build_object('connection_id',p_id)) into result; return result;
end; $$;
create function public.set_connection_scope(p_id uuid,p_resources jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.connections where id=p_id and owner_id=auth.uid()) then raise exception 'Connection not found'; end if;
  update public.connections set resources=p_resources,status='pending',last_sync_at=null where id=p_id;
  delete from public.work_items where connection_id=p_id; delete from public.pull_requests where connection_id=p_id; delete from public.activity_events where connection_id=p_id;
  perform public.enqueue_sync(p_id);
end; $$;
-- Private SQL functions are wrapped with a service-only public API for the Node consumer.
create function public.worker_secret(p_id uuid,p_ciphertext text default null) returns text language plpgsql security definer set search_path='' as $$
declare value text; begin
  if p_ciphertext is not null then update private.connection_secrets set ciphertext=p_ciphertext where connection_id=p_id; end if;
  select ciphertext into value from private.connection_secrets where connection_id=p_id; return value;
end; $$;
create function public.worker_lock(p_id uuid,p_lease uuid,p_release boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer; begin
  if p_release then delete from private.connection_locks where connection_id=p_id and lease=p_lease; return true; end if;
  insert into private.connection_locks values(p_id,now()+interval '15 minutes',p_lease)
  on conflict(connection_id) do update set locked_until=excluded.locked_until,lease=excluded.lease where private.connection_locks.locked_until<now();
  get diagnostics affected=row_count; return affected>0;
end; $$;
create function public.worker_read() returns jsonb language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(to_jsonb(q)),'[]') from pgmq.read('devsync_jobs',900,1) q; $$;
create function public.worker_ack(p_msg_id bigint,p_archive boolean default false) returns void language plpgsql security definer set search_path='' as $$ begin if p_archive then perform pgmq.archive('devsync_jobs',p_msg_id); else perform pgmq.delete('devsync_jobs',p_msg_id); end if; end; $$;
create function public.worker_delay(p_msg_id bigint,p_seconds integer) returns void language plpgsql security definer set search_path='' as $$ begin perform pgmq.set_vt('devsync_jobs',p_msg_id,p_seconds); end; $$;
create function public.ingest_delivery(p_provider text,p_delivery_id text,p_connection_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer; begin
  insert into private.webhook_deliveries(provider,delivery_id,connection_id) values(p_provider,p_delivery_id,p_connection_id) on conflict do nothing;
  get diagnostics affected=row_count; if affected=0 then return false; end if;
  perform public.enqueue_sync(p_connection_id); return true;
end; $$;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.ensure_workspace(),public.save_connection(text,text,text,jsonb,text),public.remove_connection(uuid),public.set_connection_scope(uuid,jsonb),public.enqueue_sync(uuid) to authenticated;
grant execute on all functions in schema public to service_role;

-- Reconciliation is enabled explicitly after pg_cron is available in the project.
-- No API secrets are put into cron commands: scheduled SQL only enqueues jobs.
create function public.enqueue_reconciliation() returns void language plpgsql security definer set search_path='' as $$
declare c record; begin
  for c in select id from public.connections where jsonb_array_length(resources)>0 loop perform pgmq.send('devsync_jobs',jsonb_build_object('connection_id',c.id)); end loop;
  delete from private.webhook_deliveries where received_at<now()-interval '7 days';
  delete from public.activity_events where occurred_at<now()-interval '90 days';
end; $$;
revoke all on function public.enqueue_reconciliation() from public,anon,authenticated;
grant execute on function public.enqueue_reconciliation() to service_role;
