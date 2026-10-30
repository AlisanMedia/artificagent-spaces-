-- Additive local integration only. No hosted migration or live authorization is created.
alter table jobs add column execution_kind text not null default 'local' check(execution_kind in ('local','fal-v01'));
create table v01_permit_usage (
 organization_id text not null,
 permit_id text not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
 used_requests integer not null check(used_requests between 0 and 3),
 reserved_micro_usd bigint not null check(reserved_micro_usd>=0),
 primary key(organization_id,permit_id)
);
create table v01_runs (
 organization_id text not null,
 request_id text not null,
 property_id text not null,
 revision integer not null,
 job_id text not null,
 created_by text not null,
 permit_id text not null,
 permit_sha256 text not null,
 mode text not null check(mode in ('offline-fixture','fal-live-test')),
 phase text not null check(phase in ('READY','SUBMITTING','QUEUED','RESULT','INGRESS','REVIEW','HOLD_UNKNOWN','REJECTED','CANCELLED')),
 provider_request_id text,
 status_url text,
 result_url text,
 candidate_url text,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 prompt_sha256 text not null,
 submitted_at_ms bigint,
 deadline_ms bigint not null,
 submit_deadline_ms bigint not null,
 next_poll_ms bigint not null,
 lease_until_ms bigint not null default 0,
 polls integer not null default 0 check(polls>=0),
 fence integer not null default 0,
 reserved_micro_usd bigint not null check(reserved_micro_usd>=0),
 actual_micro_usd bigint check(actual_micro_usd>=0),
 raw_sha256 text,
 error_code text,
 primary key(organization_id,request_id),
 unique(organization_id,job_id),
 unique(provider_request_id),
 foreign key(organization_id,request_id,property_id,revision) references production_requests(organization_id,id,property_id,revision),
 foreign key(organization_id,job_id) references jobs(organization_id,id),
 foreign key(organization_id,permit_id) references v01_permit_usage(organization_id,permit_id)
);
create table v01_cost_events (
 organization_id text not null,
 request_id text not null,
 id text not null,
 kind text not null check(kind in ('reserve','known-zero-offline','hold-unknown','reconcile')),
 amount_micro_usd bigint check(amount_micro_usd>=0),
 evidence_sha256 text,
 created_at timestamptz not null default now(),
 primary key(organization_id,id),
 foreign key(organization_id,request_id) references v01_runs(organization_id,request_id)
);
alter table v01_permit_usage enable row level security;
alter table v01_permit_usage force row level security;
alter table v01_runs enable row level security;
alter table v01_runs force row level security;
alter table v01_cost_events enable row level security;
alter table v01_cost_events force row level security;
revoke all on v01_permit_usage,v01_runs,v01_cost_events from public;
grant select on v01_runs,v01_cost_events to spaces_app;
create policy v01_run_read on v01_runs for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id) is not null);
create policy v01_cost_read on v01_cost_events for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id)='admin');
create trigger immutable_v01_cost before update or delete on v01_cost_events for each row execute function spaces_private.immutable_record();
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on v01_permit_usage,v01_runs,v01_cost_events from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on v01_permit_usage,v01_runs,v01_cost_events from authenticated; end if;
end $$;
