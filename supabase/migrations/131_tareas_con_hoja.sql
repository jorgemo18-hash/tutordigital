-- 131_tareas_con_hoja.sql
-- UNA TAREA PUEDE LLEVAR UNA HOJA GUARDADA (paso 3 de Recursos).
--
-- "Poner como deberes" crea la tarea del grupo a partir de una hoja
-- guardada (código H-AAMMDD-NN, migración 129). El PDF va como adjunto
-- normal —es lo que ve el alumno—, pero el adjunto es un archivo: no dice
-- qué ejercicios lleva. `hoja_id` guarda de qué hoja salió la tarea, que es
-- lo que la corrección (paso 4) necesita para saber qué se falló en cada
-- puesto (contenido_hojas.huecos).
--
-- Nullable: las tareas escritas a mano no llevan hoja. Si se borra la hoja,
-- la tarea sigue (con su PDF) y pierde el enlace. Se puede ejecutar dos veces.

alter table public.tasks
  add column if not exists hoja_id uuid references public.contenido_hojas(id) on delete set null;

create index if not exists idx_tasks_hoja_id
  on public.tasks (hoja_id) where hoja_id is not null;
