-- v7.1.2 admin teacher invites + preconfigured teacher profile

create table if not exists public.teacher_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tenant_slug text not null references public.tenants(slug) on delete cascade,
  email text not null,
  code_hash text not null,
  status text not null default 'pending' check (status in ('pending','used','revoked','expired')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz
);

create index if not exists idx_teacher_invites_tenant_status
on public.teacher_invites(tenant_slug, status);

create unique index if not exists uq_teacher_invites_pending
on public.teacher_invites(tenant_slug, email)
where status = 'pending';

create table if not exists public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null references public.tenants(slug) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (tenant_slug, email)
);

create index if not exists idx_teacher_profiles_tenant_user
on public.teacher_profiles(tenant_slug, user_id);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null references public.tenants(slug) on delete cascade,
  name text not null,
  name_norm text not null,
  created_at timestamptz not null default now(),
  unique (tenant_slug, name_norm)
);

create table if not exists public.teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.teacher_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  unique (teacher_profile_id, subject_id)
);

create table if not exists public.teacher_groups (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.teacher_profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  is_tutor boolean not null default false,
  unique (teacher_profile_id, group_id)
);

alter table if exists public.teacher_invites enable row level security;
alter table if exists public.teacher_profiles enable row level security;
alter table if exists public.subjects enable row level security;
alter table if exists public.teacher_subjects enable row level security;
alter table if exists public.teacher_groups enable row level security;

drop policy if exists teacher_invites_admin_all on public.teacher_invites;
create policy teacher_invites_admin_all
on public.teacher_invites
for all
to authenticated
using (
  public.has_active_role(
    (select t.id from public.tenants t where t.slug = teacher_invites.tenant_slug limit 1),
    array['admin']
  )
)
with check (
  public.has_active_role(
    (select t.id from public.tenants t where t.slug = teacher_invites.tenant_slug limit 1),
    array['admin']
  )
);

drop policy if exists teacher_profiles_admin_all on public.teacher_profiles;
create policy teacher_profiles_admin_all
on public.teacher_profiles
for all
to authenticated
using (
  public.has_active_role(
    (select t.id from public.tenants t where t.slug = teacher_profiles.tenant_slug limit 1),
    array['admin']
  )
)
with check (
  public.has_active_role(
    (select t.id from public.tenants t where t.slug = teacher_profiles.tenant_slug limit 1),
    array['admin']
  )
);

drop policy if exists subjects_admin_all on public.subjects;
create policy subjects_admin_all
on public.subjects
for all
to authenticated
using (
  public.has_active_role(
    (select t.id from public.tenants t where t.slug = subjects.tenant_slug limit 1),
    array['admin']
  )
)
with check (
  public.has_active_role(
    (select t.id from public.tenants t where t.slug = subjects.tenant_slug limit 1),
    array['admin']
  )
);

drop policy if exists teacher_subjects_admin_all on public.teacher_subjects;
create policy teacher_subjects_admin_all
on public.teacher_subjects
for all
to authenticated
using (
  exists (
    select 1
    from public.teacher_profiles tp
    join public.tenants t on t.slug = tp.tenant_slug
    where tp.id = teacher_subjects.teacher_profile_id
      and public.has_active_role(t.id, array['admin'])
  )
)
with check (
  exists (
    select 1
    from public.teacher_profiles tp
    join public.tenants t on t.slug = tp.tenant_slug
    where tp.id = teacher_subjects.teacher_profile_id
      and public.has_active_role(t.id, array['admin'])
  )
);

drop policy if exists teacher_groups_admin_all on public.teacher_groups;
create policy teacher_groups_admin_all
on public.teacher_groups
for all
to authenticated
using (
  exists (
    select 1
    from public.teacher_profiles tp
    join public.tenants t on t.slug = tp.tenant_slug
    where tp.id = teacher_groups.teacher_profile_id
      and public.has_active_role(t.id, array['admin'])
  )
)
with check (
  exists (
    select 1
    from public.teacher_profiles tp
    join public.tenants t on t.slug = tp.tenant_slug
    where tp.id = teacher_groups.teacher_profile_id
      and public.has_active_role(t.id, array['admin'])
  )
);
