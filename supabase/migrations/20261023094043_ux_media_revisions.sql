-- V3 local-only media collections. No hosted schema operation.
alter table assets drop constraint assets_bytes_check;
alter table assets add constraint assets_bytes_check check(bytes>=1 and ((kind='walkthrough' and bytes<=20971520) or (kind<>'walkthrough' and bytes<=5242880)));
alter table assets add column duration_seconds double precision check(duration_seconds>0 and duration_seconds<=30.2);
create index jobs_property_revision on jobs(organization_id,property_id,revision);
create table property_media_revisions(
 organization_id text not null,
 property_id text not null,
 revision integer not null,
 asset_id text not null,
 position integer not null check(position between 0 and 19),
 primary key(organization_id,property_id,revision,asset_id),
 unique(organization_id,property_id,revision,position),
 foreign key(organization_id,property_id,revision) references property_revisions(organization_id,property_id,revision),
 foreign key(organization_id,property_id,asset_id) references assets(organization_id,property_id,id)
);
insert into property_media_revisions select r.organization_id,r.property_id,r.revision,a.id,(row_number() over(partition by r.organization_id,r.property_id,r.revision order by a.created_at,a.id)-1)::int from property_revisions r join assets a on a.organization_id=r.organization_id and a.property_id=r.property_id where a.status='clean';
alter table property_media_revisions enable row level security;
alter table property_media_revisions force row level security;
revoke all on property_media_revisions from public;
grant select,insert on property_media_revisions to spaces_app;
create policy media_read on property_media_revisions for select to spaces_app using(organization_id=spaces_org() and spaces_role(organization_id) is not null);
create policy media_insert on property_media_revisions for insert to spaces_app with check(organization_id=spaces_org() and spaces_role(organization_id) in ('admin','editor'));
create trigger immutable_media_revision before update or delete on property_media_revisions for each row execute function spaces_private.immutable_record();
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on property_media_revisions from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on property_media_revisions from authenticated; end if;
end $$;

create function spaces_private.frozen_media_guard() returns trigger language plpgsql security invoker set search_path=public as $$ begin
 if exists(select 1 from jobs where organization_id=new.organization_id and property_id=new.property_id and revision=new.revision) then raise exception 'MEDIA_REVISION_FROZEN'; end if;
 return new;
end $$;
create trigger frozen_media before insert on property_media_revisions for each row execute function spaces_private.frozen_media_guard();
