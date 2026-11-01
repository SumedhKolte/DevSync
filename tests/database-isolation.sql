-- Transactional integration checks: fixture users and records are rolled back.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','devsync-test-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','devsync-test-b@example.invalid');
insert into public.workspaces(id,owner_id,name) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Test A'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Test B');
insert into public.connections(id,workspace_id,owner_id,provider,provider_account_id,label,status,last_sync_at) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','jira','site-a','A','connected',now()),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','jira','site-b','B','connected',now()),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','github','install-a','Stale','connected',now()-interval '31 minutes');
insert into public.work_items(workspace_id,connection_id,provider_id,issue_key,title,payload) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','1','A-1','Private A','{}'),
 ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','2','B-1','Private B','{}');
insert into public.pull_requests(workspace_id,connection_id,provider_id,repository,title,payload) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','3','private/stale','Stale PR','{}');
insert into public.activity_events(workspace_id,connection_id,provider_id,payload,occurred_at) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','revoked-source-event','{}',now());
insert into public.source_resources(workspace_id,connection_id,kind,provider_id,payload) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','repository','stale-resource','{}');
do $$ begin
  begin
    insert into public.work_items(workspace_id,connection_id,provider_id,issue_key,title,payload) values('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','cross','X-1','Cross-tenant','{}');
    raise exception 'FAILED: cross-tenant foreign key accepted';
  exception when foreign_key_violation then null; end;
end; $$;
do $$ declare lease uuid:='40000000-0000-4000-8000-000000000001'; rows jsonb:='[{"id":"1","key":"A-1","title":"Private A"}]'; begin
  if not public.worker_lock('30000000-0000-4000-8000-000000000001',lease) then raise exception 'FAILED: worker lock'; end if;
  perform public.publish_snapshot('30000000-0000-4000-8000-000000000001',lease,0,rows,'[]');
  perform public.publish_snapshot('30000000-0000-4000-8000-000000000001',lease,0,rows,'[]');
  if (select count(*) from public.work_items where connection_id='30000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAILED: snapshot idempotency'; end if;
  if exists(select 1 from public.activity_events where connection_id='30000000-0000-4000-8000-000000000001') then raise exception 'FAILED: obsolete source events retained'; end if;
  begin
    perform public.publish_snapshot('30000000-0000-4000-8000-000000000001',lease,999,rows,'[]');
    raise exception 'FAILED: changed-scope snapshot accepted';
  exception when raise_exception then if sqlerrm<>'Connection changed during import' then raise; end if; end;
  perform public.worker_lock('30000000-0000-4000-8000-000000000001',lease,true);
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.workspaces)<>1 then raise exception 'FAILED: workspace isolation'; end if;
  if (select count(*) from public.connections)<>2 then raise exception 'FAILED: connection isolation'; end if;
  if (select count(*) from public.work_items)<>1 then raise exception 'FAILED: work item isolation'; end if;
  if exists(select 1 from public.work_items where issue_key='B-1') then raise exception 'FAILED: cross-user issue disclosure'; end if;
  if exists(select 1 from public.pull_requests) then raise exception 'FAILED: stale access did not fail closed'; end if;
  if exists(select 1 from public.source_resources) then raise exception 'FAILED: stale metadata access'; end if;
  begin perform public.worker_secret('30000000-0000-4000-8000-000000000001'); raise exception 'FAILED: worker secret exposed'; exception when insufficient_privilege then null; end;
  begin insert into public.work_items(workspace_id,connection_id,provider_id,issue_key,title,payload) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','evil','A-99','Injected','{}'); raise exception 'FAILED: imported record write allowed'; exception when insufficient_privilege then null; end;
  begin update public.workspaces set owner_id='10000000-0000-4000-8000-000000000002'; raise exception 'FAILED: owner reassignment allowed'; exception when insufficient_privilege then null; end;
end; $$;
set local role anon;
do $$ begin begin perform 1 from public.work_items; raise exception 'FAILED: anonymous read allowed'; exception when insufficient_privilege then null; end; end; $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ begin
  if not public.ingest_delivery('jira','test-delivery','30000000-0000-4000-8000-000000000001') then raise exception 'FAILED: first delivery rejected'; end if;
  if public.ingest_delivery('jira','test-delivery','30000000-0000-4000-8000-000000000001') then raise exception 'FAILED: duplicate delivery accepted'; end if;
end; $$;
rollback;
select 'passed' as result, 'RLS, stale access, anonymous denial, immutable ownership, cross-tenant constraints, secret protection, read-only imports, delivery deduplication' as checks;
