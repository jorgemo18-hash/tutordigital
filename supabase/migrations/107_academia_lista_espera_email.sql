-- 107_academia_lista_espera_email.sql
-- Email propio en la lista de espera.
--
-- La tabla solo tenía `telefono`, y el formulario lo etiquetaba "Teléfono
-- o email": dos datos distintos metidos en la misma casilla. Eso hace que
-- no se pueda ni filtrar ni escribir a nadie de la lista sin leer el campo
-- a ojo, y que un contacto quede con teléfono O con email, nunca con los
-- dos — que es justo lo que hace falta cuando en octubre se libera una
-- plaza y hay que avisar.
--
-- Nullable a propósito: media lista de espera se apunta por teléfono en el
-- mostrador y no deja email. Exigirlo convertiría un apunte de diez
-- segundos en un interrogatorio.
--
-- No se migra nada del contenido actual de `telefono` a `email`: adivinar
-- cuál de los valores existentes era en realidad un correo (buscando una
-- arroba, por ejemplo) es una reescritura silenciosa de datos que el admin
-- no ha pedido y no puede revisar. Los apuntes viejos se quedan como
-- están; el admin los edita si quiere, ahora que se puede editar.

alter table public.academia_lista_espera
  add column if not exists email text;

comment on column public.academia_lista_espera.email is
  'Email de contacto. NULL si solo dejaron teléfono.';
