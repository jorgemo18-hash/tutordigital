-- 036_tasks_add_subject_name.sql
-- Añade campo asignatura a tareas para mostrar el tag de materia en la agenda del alumno

alter table tasks
  add column if not exists subject_name text;
