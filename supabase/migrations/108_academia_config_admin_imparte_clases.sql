-- 108_academia_config_admin_imparte_clases.sql
-- El administrador del centro también da clase.
--
-- En academias pequeñas (el caso de Lyceo) el dueño es a la vez el
-- administrador y el profesor. Hasta ahora eso obligaba a tener DOS cuentas
-- y a cerrar sesión para pasar de una tarea a otra, porque el diario y las
-- notas de examen solo existen en el panel de profesor.
--
-- POR QUÉ NO ES UN TIPO DE CENTRO NUEVO (se valoró y se descartó):
-- `tenants.type` describe el despliegue (academia / standalone / integrado)
-- y el régimen fiscal va aparte (autónomo / sociedad). "Unipersonal" no es
-- ninguna de las dos cosas: es cuántos sombreros lleva una persona, y es
-- ortogonal a ambas. Como tipo obligaría a inventar "unipersonal+autónomo",
-- "unipersonal+sociedad", etc. Es una propiedad del centro, y va donde ya
-- viven las demás propiedades del centro.
--
-- POR QUÉ NO SE DUPLICA LA MEMBRESÍA:
-- se valoró dar de alta al admin también como `teacher`. No se puede:
-- tenant_memberships tiene UNIQUE (tenant_id, user_id) — una cuenta solo
-- puede tener un rol por centro. Quitar esa restricción rompería todas las
-- consultas que asumen "un usuario, un rol". Y no hace falta: las rutas de
-- sesiones, notas de examen y horario YA aceptan rol admin, y el diario
-- devuelve al admin todos los alumnos del centro (ver fetchDiarioVisible en
-- academia.sesiones.routes.js). Lo único que faltaba era la pantalla.
--
-- Así que esto NO da permisos nuevos: solo decide si se muestra la sección
-- "Dar clase" en el panel de admin. Apagado por defecto, igual que
-- control_horario_activo y acceso_tutor_activo — un centro con profesores
-- contratados no debe encontrarse una sección nueva sin haberla pedido.

alter table public.academia_config
  add column if not exists admin_imparte_clases boolean not null default false;

comment on column public.academia_config.admin_imparte_clases is
  'El admin del centro también da clase: muestra la sección "Dar clase" (diario y notas) en su panel. No otorga permisos — las rutas ya aceptaban rol admin.';
