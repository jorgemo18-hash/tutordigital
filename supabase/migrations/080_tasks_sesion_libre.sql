-- 080_tasks_sesion_libre.sql
-- Sesión libre: sesión de tutor sin tarea asignada por un profesor (caso
-- academia: el alumno sube sus propios deberes del cole). Es una tarea de
-- sistema de tipo 'sesion_libre', propia de un alumno (student_id) en vez
-- de un grupo (group_id, que se deja NULL). Mantiene el invariante "toda
-- sesión de tutor cuelga de una tarea" sin tocar /api/v1/attachments ni
-- /api/v1/session/start.

alter table public.tasks
  drop constraint tasks_type_check;

alter table public.tasks
  add constraint tasks_type_check
  check (type = any (array['homework', 'exam', 'work', 'sesion_libre']));

alter table public.tasks
  add column student_id uuid references public.students(id) on delete cascade;

create index idx_tasks_student_id
  on public.tasks (student_id)
  where student_id is not null;

comment on column public.tasks.student_id is
  'Tareas de sistema propias de un alumno (p.ej. sesion_libre), sin group_id. NULL para tareas normales de grupo asignadas por un profesor.';
