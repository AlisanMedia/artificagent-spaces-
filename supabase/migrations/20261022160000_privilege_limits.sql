-- Forward-only local hardening; not applied to any cloud resource.
create or replace function public.spaces_uid() returns text language sql stable security invoker set search_path=public as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'sub','') $$;
alter policy org_read on organizations using(spaces_role(id) is not null);
drop policy jobs_insert on jobs;
drop policy jobs_update on jobs;
revoke insert,update on jobs from spaces_app;
alter table jobs add column source_snapshot jsonb not null default '[]';
alter table credit_accounts add constraint safe_integer_credit_balance check(available<=9007199254740991 and reserved<=9007199254740991);
create index jobs_queue_claim on jobs(created_at) where state='queued';
create index voice_session_provider_lookup on voice_sessions(organization_id,(body->>'providerConversationId')) where body->>'providerConversationId' is not null;
create index analytics_session_recent on analytics_events(organization_id,session_id,created_at);
create index publication_expiry on publications(organization_id,expires_at) where not revoked;
