-- Local-only extension. No hosted migration executed.
create table job_attempts(organization_id text not null, job_id text not null, attempt integer not null check(attempt between 1 and 3), fence text not null, epoch integer not null, provider text not null check(provider='local-ffmpeg-blender'), state text not null check(state in ('processing','succeeded','failed','fenced')), output_hash text, error_code text, started_at timestamptz not null default now(), finished_at timestamptz, primary key(organization_id,job_id,attempt), foreign key(organization_id,job_id) references jobs(organization_id,id));
alter table job_attempts enable row level security;
alter table job_attempts force row level security;
create policy attempts_read on job_attempts for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id) in ('admin','editor','reviewer'));
revoke all on job_attempts from public;
grant select on job_attempts to spaces_app;
create table sandbox_payment_events(organization_id text not null references organizations(id), id text not null, body_hash text not null, simulated_amount bigint not null check(simulated_amount between 0 and 1000000), created_at timestamptz not null default now(), primary key(organization_id,id));
alter table sandbox_payment_events enable row level security;
alter table sandbox_payment_events force row level security;
create policy sandbox_events_read on sandbox_payment_events for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id)='admin');
revoke all on sandbox_payment_events from public;
grant select on sandbox_payment_events to spaces_app;
create trigger immutable_sandbox before update or delete on sandbox_payment_events for each row execute function spaces_private.immutable_record();
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on job_attempts,sandbox_payment_events from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on job_attempts,sandbox_payment_events from authenticated; end if;
end $$;
