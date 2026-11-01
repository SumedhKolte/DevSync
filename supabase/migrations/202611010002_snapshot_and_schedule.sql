alter table public.connections add column scope_version integer not null default 0;
-- A generation fences in-flight imports when a user reconnects or changes scope.
create function private.bump_connection_version() returns trigger language plpgsql set search_path='' as $$ begin if new.resources is distinct from old.resources or new.provider_account_id is distinct from old.provider_account_id then new.scope_version:=old.scope_version+1; end if; return new; end; $$;
create trigger connection_version before update on public.connections for each row execute function private.bump_connection_version();
create function public.publish_snapshot(p_id uuid,p_lease uuid,p_scope_version integer,p_rows jsonb,p_events jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c public.connections; begin
  select * into c from public.connections where id=p_id for update;
  if c.id is null or c.scope_version<>p_scope_version or not exists(select 1 from private.connection_locks where connection_id=p_id and lease=p_lease and locked_until>now()) then raise exception 'Connection changed during import'; end if;
  if c.provider='jira' then
    insert into public.work_items(workspace_id,connection_id,provider_id,issue_key,title,payload,updated_at)
    select c.workspace_id,c.id,r->>'id',r->>'key',r->>'title',r,now() from jsonb_array_elements(p_rows) r
    on conflict(connection_id,provider_id) do update set issue_key=excluded.issue_key,title=excluded.title,payload=excluded.payload,updated_at=excluded.updated_at;
    delete from public.work_items w where w.connection_id=c.id and not exists(select 1 from jsonb_array_elements(p_rows) r where r->>'id'=w.provider_id);
  else
    insert into public.pull_requests(workspace_id,connection_id,provider_id,repository,title,payload,updated_at)
    select c.workspace_id,c.id,r->>'id',r->>'repository',r->>'title',r,now() from jsonb_array_elements(p_rows) r
    on conflict(connection_id,provider_id) do update set repository=excluded.repository,title=excluded.title,payload=excluded.payload,updated_at=excluded.updated_at;
    delete from public.pull_requests p where p.connection_id=c.id and not exists(select 1 from jsonb_array_elements(p_rows) r where r->>'id'=p.provider_id);
  end if;
  insert into public.activity_events(workspace_id,connection_id,provider_id,payload,occurred_at)
  select c.workspace_id,c.id,e->>'id',e,(e->>'at')::timestamptz from jsonb_array_elements(p_events) e
  on conflict(connection_id,provider_id) do update set payload=excluded.payload,occurred_at=excluded.occurred_at;
  delete from public.development_links where workspace_id=c.workspace_id;
  -- Exact extracted keys only. Every edge records the field(s) supplying the reference.
  insert into public.development_links(workspace_id,work_item_id,pull_request_id,evidence)
  select c.workspace_id,w.id,p.id,jsonb_build_object('rule','validated-jira-key','key',w.issue_key,'sources',p.payload->'linkEvidence')
  from public.work_items w join public.pull_requests p on p.workspace_id=w.workspace_id
  where w.workspace_id=c.workspace_id and (p.payload->'issueKeys') ? w.issue_key;
  update public.connections set status='connected',last_sync_at=now(),last_error=null where id=p_id;
end; $$;
revoke all on function public.publish_snapshot(uuid,uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_snapshot(uuid,uuid,integer,jsonb,jsonb) to service_role;
-- Supabase-hosted projects support pg_cron. Enable and enqueue every ten minutes.
create extension if not exists pg_cron;
select cron.schedule('devsync-reconciliation','*/10 * * * *','select public.enqueue_reconciliation()');
