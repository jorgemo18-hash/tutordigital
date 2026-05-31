-- 041_teacher_group_subjects_unique.sql
-- Add unique constraint on (teacher_profile_id, group_id, subject_id) so DELETE+INSERT
-- in syncTeacherGroups is safe against duplicates.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'teacher_group_subjects_profile_group_subject_key'
      and conrelid = 'public.teacher_group_subjects'::regclass
  ) then
    alter table public.teacher_group_subjects
      add constraint teacher_group_subjects_profile_group_subject_key
      unique (teacher_profile_id, group_id, subject_id);
  end if;
end;
$$;
