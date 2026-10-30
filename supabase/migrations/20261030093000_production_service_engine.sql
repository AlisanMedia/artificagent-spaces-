-- V5.7: additive local/PGlite migration, not a hosted database operation.
create table production_requests (
 organization_id text not null,
 id text not null,
 property_id text not null,
 revision integer not null,
 service_id text not null check(service_id in ('V01','V02','V03','V04','P01','P02','P03','P04','P05','P06','P07','P07b','T01','T02','B01')),
 created_by text not null,
 idempotency_key text not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 profile jsonb not null,
 options jsonb not null,
 rights jsonb not null,
 state text not null check(state in ('awaiting-provider-approval','cancelled','processing','qa-held','awaiting-review','approved','rejected')),
 fence integer not null default 0 check(fence>=0),
 provider_request_id text,
 reserved_micro_usd bigint not null default 0 check(reserved_micro_usd=0),
 actual_micro_usd bigint check(actual_micro_usd=0),
 created_at timestamptz not null default now(),
 primary key(organization_id,id),
 unique(organization_id,id,property_id,revision),
 unique(organization_id,idempotency_key),
 foreign key(organization_id,property_id,revision) references property_revisions(organization_id,property_id,revision)
);
create unique index production_provider_request_unique on production_requests(provider_request_id) where provider_request_id is not null;
create index production_property_revision on production_requests(organization_id,property_id,revision);
create table production_sources (
 organization_id text not null,
 request_id text not null,
 property_id text not null,
 revision integer not null,
 asset_id text not null,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 position integer not null check(position between 0 and 11),
 primary key(organization_id,request_id,asset_id),
 unique(organization_id,request_id,position),
 unique(organization_id,request_id,source_sha256),
 foreign key(organization_id,request_id,property_id,revision) references production_requests(organization_id,id,property_id,revision),
 foreign key(organization_id,property_id,revision,asset_id) references property_media_revisions(organization_id,property_id,revision,asset_id)
);
create table provider_callback_inbox (
 organization_id text not null,
 request_id text not null,
 provider_request_id text not null,
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 event_status text not null check(event_status in ('OK','ERROR')),
 received_at timestamptz not null default now(),
 primary key(organization_id,request_id,body_sha256),
 foreign key(organization_id,request_id) references production_requests(organization_id,id)
);
alter table production_requests enable row level security;
alter table production_requests force row level security;
alter table production_sources enable row level security;
alter table production_sources force row level security;
alter table provider_callback_inbox enable row level security;
alter table provider_callback_inbox force row level security;
revoke all on production_requests, production_sources, provider_callback_inbox from public;
grant select,insert on production_requests, production_sources to spaces_app;
grant select on provider_callback_inbox to spaces_app;
create policy production_read on production_requests for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id) is not null);
create policy production_insert on production_requests for insert to spaces_app with check(organization_id=spaces_org() and spaces_role(organization_id) in ('admin','editor') and created_by=spaces_uid() and state='awaiting-provider-approval' and fence=0 and provider_request_id is null and actual_micro_usd is null);
create policy production_sources_read on production_sources for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id) is not null);
create policy production_sources_insert on production_sources for insert to spaces_app with check(organization_id=spaces_org() and spaces_role(organization_id) in ('admin','editor') and exists(select 1 from production_requests r where r.organization_id=production_sources.organization_id and r.id=production_sources.request_id and r.created_by=spaces_uid() and r.state='awaiting-provider-approval'));
create policy callback_read on provider_callback_inbox for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id)='admin');
create trigger immutable_production_source before update or delete on production_sources for each row execute function spaces_private.immutable_record();
create trigger immutable_provider_callback before update or delete on provider_callback_inbox for each row execute function spaces_private.immutable_record();
create or replace function spaces_private.frozen_media_guard() returns trigger language plpgsql security invoker set search_path=public as $$ begin
 if exists(select 1 from jobs where organization_id=new.organization_id and property_id=new.property_id and revision=new.revision)
 or exists(select 1 from production_requests where organization_id=new.organization_id and property_id=new.property_id and revision=new.revision)
 then raise exception 'MEDIA_REVISION_FROZEN'; end if;
 return new;
end $$;
create table production_artifacts (
 organization_id text not null,
 request_id text not null,
 artifact_id text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 bytes integer not null check(bytes>0 and bytes<=20971520),
 qa jsonb not null,
 origin text not null check(origin='OFFLINE_CONTRACT_FIXTURE'),
 revoked boolean not null default false,
 primary key(organization_id,request_id),
 unique(organization_id,artifact_id),
 foreign key(organization_id,request_id) references production_requests(organization_id,id)
);
create table production_reviews (
 organization_id text not null,
 request_id text not null,
 id text not null,
 reviewer_id text not null,
 output_sha256 text not null check(output_sha256 ~ '^[a-f0-9]{64}$'),
 checks jsonb not null,
 created_at timestamptz not null default now(),
 primary key(organization_id,id),
 foreign key(organization_id,request_id) references production_artifacts(organization_id,request_id)
);
alter table production_artifacts enable row level security;
alter table production_artifacts force row level security;
alter table production_reviews enable row level security;
alter table production_reviews force row level security;
revoke all on production_artifacts,production_reviews from public;
grant select on production_artifacts,production_reviews to spaces_app;
create policy artifact_read on production_artifacts for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id) is not null);
create policy production_review_read on production_reviews for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id) is not null);
create trigger immutable_production_review before update or delete on production_reviews for each row execute function spaces_private.immutable_record();
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on production_requests,production_sources,provider_callback_inbox,production_artifacts,production_reviews from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on production_requests,production_sources,provider_callback_inbox,production_artifacts,production_reviews from authenticated; end if;
end $$;
