-- 109_academia_horario_profesor_id.sql
-- Quién imparte cada franja del horario.
--
-- Hasta ahora una franja era (alumno, día, hora) y nada más: no existía el
-- dato de quién da esa clase. "El horario de un profesor" se deducía de sus
-- alumnos asignados (academia_profesor_alumnos), lo que hace imposible
-- expresar algo tan normal como "a Marta la lleva María los martes y Pedro
-- los jueves". Con un solo profesor da igual; con cinco, es el caso común.
--
-- POR QUÉ AHORA Y NO ANTES: el 26/08 se decidió NO añadir esta columna
-- justamente porque habría sido esquema muerto — Lyceo tiene un profesor y
-- nadie había pedido la función. Deja de serlo en cuanto se pide el horario
-- por profesor, que es lo que la hace necesaria.
--
-- NULLABLE a propósito, y no es un descuido:
--   - las franjas que ya existen en cualquier centro no tienen profesor y
--     no hay forma honesta de adivinarlo (deducirlo de las asignaciones
--     sería inventar un dato que el admin no ha escrito y no puede revisar);
--   - "franja sin profesor asignado" es un estado legítimo y útil: es
--     justamente lo que el admin necesita ver para detectar huecos al
--     cuadrar el curso.
--
-- ON DELETE SET NULL: dar de baja a un profesor NO puede borrar el horario
-- del centro. La franja sigue existiendo (el alumno sigue viniendo a esa
-- hora); lo que queda vacío es quién la imparte, que es exactamente el
-- problema que el admin tiene que resolver cuando alguien se va.
--
-- Índice sobre (tenant_id, profesor_id): la consulta "las franjas de este
-- profesor" pasa a ser la del panel de profesor y la del filtro del admin.

alter table public.academia_horario
  add column if not exists profesor_id uuid
  references public.teacher_profiles(id) on delete set null;

create index if not exists academia_horario_tenant_profesor_idx
  on public.academia_horario (tenant_id, profesor_id);

comment on column public.academia_horario.profesor_id is
  'Quién imparte esta franja. NULL = sin asignar (estado legítimo: sirve para detectar huecos). Al dar de baja a un profesor se pone a NULL, nunca se borra la franja.';
