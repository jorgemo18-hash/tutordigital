-- 010_rls_policies_min.sql
-- RLS baseline: secure-by-default, keep backend service-role working (service role bypasses RLS)
-- Notes:
-- - These policies are intentionally conservative.
-- - Teachers/Admins: full tenant access
-- - Students: access only their own records + their group's tasks + their own tickets/grades/status

-- Helper functions (SECURITY DEFINER) to avoid repeating logic everywhere.
-- Important: set a fixed search_path.
create or replace function public.is_active_member(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = _tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_active_role(_tenant_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = _tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (_roles)
  );
$$;

create or replace function public.current_student_id(_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select s.id
  from public.students s
  where s.tenant_id = _tenant_id
    and s.user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_student_group_id(_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select s.group_id
  from public.students s
  where s.tenant_id = _tenant_id
    and s.user_id = auth.uid()
  limit 1
$$;

-- ----------------------------
-- Enable RLS
-- ----------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.tasks enable row level security;
alter table public.attachments enable row level security;
alter table public.student_task_status enable row level security;
alter table public.tickets enable row level security;
alter table public.grades enable row level security;
alter table public.invites enable row level security;

-- Optional hardening: force RLS so even table owners respect it (service_role still bypasses).
-- If you are unsure, comment these out for now.
-- alter table public.tenants force row level security;
-- alter table public.profiles force row level security;
-- alter table public.tenant_memberships force row level security;
-- alter table public.groups force row level security;
-- alter table public.students force row level security;
-- alter table public.tasks force row level security;
-- alter table public.attachments force row level security;
-- alter table public.student_task_status force row level security;
-- alter table public.tickets force row level security;
-- alter table public.grades force row level security;
-- alter table public.invites force row level security;

-- ----------------------------
-- TENANTS
-- ----------------------------
drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member
on public.tenants
for select
to authenticated
using (public.is_active_member(id));

-- ----------------------------
-- PROFILES
-- ----------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ----------------------------
-- TENANT_MEMBERSHIPS
-- ----------------------------
drop policy if exists memberships_select_self_or_admin on public.tenant_memberships;
create policy memberships_select_self_or_admin
on public.tenant_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_active_role(tenant_id, array['admin'])
);

drop policy if exists memberships_admin_write on public.tenant_memberships;
create policy memberships_admin_write
on public.tenant_memberships
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- GROUPS
-- ----------------------------
drop policy if exists groups_select_member on public.groups;
create policy groups_select_member
on public.groups
for select
to authenticated
using (public.is_active_member(tenant_id));

drop policy if exists groups_teacher_admin_write on public.groups;
create policy groups_teacher_admin_write
on public.groups
for insert, update, delete
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- ----------------------------
-- STUDENTS
-- ----------------------------
drop policy if exists students_select_teacher_admin_or_self on public.students;
create policy students_select_teacher_admin_or_self
on public.students
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or user_id = auth.uid()
);

drop policy if exists students_insert_teacher_admin on public.students;
create policy students_insert_teacher_admin
on public.students
for insert
to authenticated
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- Allow students to update ONLY their own row (conservative: allow changing status/display_name)
drop policy if exists students_update_self on public.students;
create policy students_update_self
on public.students
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists students_update_teacher_admin on public.students;
create policy students_update_teacher_admin
on public.students
for update
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- ----------------------------
-- TASKS
-- ----------------------------
drop policy if exists tasks_select_teacher_admin_or_student_group on public.tasks;
create policy tasks_select_teacher_admin_or_student_group
on public.tasks
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and (
      group_id is null
      or group_id = public.current_student_group_id(tenant_id)
    )
  )
);

drop policy if exists tasks_teacher_admin_write on public.tasks;
create policy tasks_teacher_admin_write
on public.tasks
for insert, update, delete
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- ----------------------------
-- TICKETS
-- ----------------------------
drop policy if exists tickets_select_teacher_admin_or_own on public.tickets;
create policy tickets_select_teacher_admin_or_own
on public.tickets
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
);

drop policy if exists tickets_insert_student_or_teacher on public.tickets;
create policy tickets_insert_student_or_teacher
on public.tickets
for insert
to authenticated
with check (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
);

drop policy if exists tickets_update_teacher_admin_or_own on public.tickets;
create policy tickets_update_teacher_admin_or_own
on public.tickets
for update
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
)
with check (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
);

-- ----------------------------
-- GRADES
-- ----------------------------
drop policy if exists grades_select_teacher_admin_or_own on public.grades;
create policy grades_select_teacher_admin_or_own
on public.grades
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
);

drop policy if exists grades_teacher_admin_write on public.grades;
create policy grades_teacher_admin_write
on public.grades
for insert, update, delete
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- ----------------------------
-- STUDENT_TASK_STATUS
-- ----------------------------
drop policy if exists sts_select_teacher_admin_or_own on public.student_task_status;
create policy sts_select_teacher_admin_or_own
on public.student_task_status
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
);

drop policy if exists sts_insert_teacher_admin_or_own on public.student_task_status;
create policy sts_insert_teacher_admin_or_own
on public.student_task_status
for insert
to authenticated
with check (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
);

drop policy if exists sts_update_teacher_admin_or_own on public.student_task_status;
create policy sts_update_teacher_admin_or_own
on public.student_task_status
for update
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
)
with check (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or (
    public.has_active_role(tenant_id, array['student'])
    and student_id = public.current_student_id(tenant_id)
  )
);

-- ----------------------------
-- ATTACHMENTS
-- ----------------------------
-- Conservative:
-- - Teachers/Admin: all in tenant
-- - Students: only ones they uploaded
drop policy if exists attachments_select_teacher_admin_or_uploader on public.attachments;
create policy attachments_select_teacher_admin_or_uploader
on public.attachments
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or uploader_id = auth.uid()
);

drop policy if exists attachments_insert_member on public.attachments;
create policy attachments_insert_member
on public.attachments
for insert
to authenticated
with check (public.is_active_member(tenant_id));

drop policy if exists attachments_update_teacher_admin_or_uploader on public.attachments;
create policy attachments_update_teacher_admin_or_uploader
on public.attachments
for update
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or uploader_id = auth.uid()
)
with check (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or uploader_id = auth.uid()
);

drop policy if exists attachments_delete_teacher_admin_or_uploader on public.attachments;
create policy attachments_delete_teacher_admin_or_uploader
on public.attachments
for delete
to authenticated
using (
  public.has_active_role(tenant_id, array['admin','teacher'])
  or uploader_id = auth.uid()
);

-- ----------------------------
-- INVITES
-- ----------------------------
drop policy if exists invites_select_admin_teacher on public.invites;
create policy invites_select_admin_teacher
on public.invites
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']));

drop policy if exists invites_write_admin_teacher on public.invites;
create policy invites_write_admin_teacher
on public.invites
for insert, update, delete
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));
