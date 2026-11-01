-- Metadata and activity are reconciled in the same transaction as imported records.
create table public.source_resources (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 connection_id uuid not null, kind text not null check(kind in ('repository','sprint')), provider_id text not null, payload jsonb not null,
 foreign key(connection_id,workspace_id) references public.connections(id,workspace_id) on delete cascade,
 unique(connection_id,kind,provider_id)
);
create index source_resources_workspace on public.source_resources(workspace_id);
alter table public.source_resources enable row level security;
create policy resource_owner_read on public.source_resources for select to authenticated using(exists(select 1 from public.connections c where c.id=connection_id and c.owner_id=(select auth.uid()) and c.last_sync_at>now()-interval '30 minutes' and c.status='connected'));
revoke all on public.source_resources from anon,authenticated;
grant select on public.source_resources to authenticated;
grant all on public.source_resources to service_role;
drop function public.publish_snapshot(uuid,uuid,integer,jsonb,jsonb);
create function public.publish_snapshot(p_id uuid,p_lease uuid,p_scope_version integer,p_rows jsonb,p_events jsonb,p_resources jsonb default '[]') returns void language plpgsql security definer set search_path='' as $$
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
  delete from public.activity_events where connection_id=p_id;
  delete from public.source_resources where connection_id=p_id;
  insert into public.source_resources(workspace_id,connection_id,kind,provider_id,payload)
  select c.workspace_id,c.id,r->>'kind',r->'payload'->>'id',r->'payload' from jsonb_array_elements(p_resources) r;
  insert into public.activity_events(workspace_id,connection_id,provider_id,payload,occurred_at)
  select c.workspace_id,c.id,e->>'id',e,(e->>'at')::timestamptz from jsonb_array_elements(p_events) e where (e->>'at')::timestamptz>now()-interval '90 days'
  on conflict(connection_id,provider_id) do update set payload=excluded.payload,occurred_at=excluded.occurred_at;
  delete from public.development_links where workspace_id=c.workspace_id;
  -- Exact extracted keys only. Every edge records the field(s) supplying the reference.
  insert into public.development_links(workspace_id,work_item_id,pull_request_id,evidence)
  select c.workspace_id,w.id,p.id,jsonb_build_object('rule','validated-jira-key','key',w.issue_key,'sources',p.payload->'linkEvidence')
  from public.work_items w join public.pull_requests p on p.workspace_id=w.workspace_id
  where w.workspace_id=c.workspace_id and (p.payload->'issueKeys') ? w.issue_key;
  update public.connections set status='connected',last_sync_at=now(),last_error=null where id=p_id;
end; $$;
revoke all on function public.publish_snapshot(uuid,uuid,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_snapshot(uuid,uuid,integer,jsonb,jsonb,jsonb) to service_role;
