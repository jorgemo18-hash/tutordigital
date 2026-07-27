import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { resolverAlumnoIdsVisibles } from "../../lib/academiaProfesores/resolverAlumnosVisibles.js";
import { resolverBadgesSustitucion } from "../../lib/academiaProfesores/sustitucionBadge.js";

// Duplicado a propósito desde academia.sesiones.routes.js (mismo criterio
// que ya se documentó en academia.notas-examen.routes.js: es la misma
// consulta de 6 líneas, y cruzar imports entre route files no está en el
// alcance de este cambio). teacher_profiles no tiene columna tenant_id —
// solo tenant_slug (ver 014_admin_teacher_invites.sql).
export async function findProfesorId(admin, tenantSlug, userId) {
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id || null;
}

// Toda la lógica de "qué franjas puede ver este usuario" en una sola
// función, sin nada de Fastify — así el test de regresión de la regla de
// seguridad (profesor sin asignaciones -> [] , nunca el tenant entero)
// cubre exactamente lo que corre en producción, no una versión resumida.
export async function fetchFranjasVisibles(admin, { tenantId, tenantSlug, userId, role, findProfesorIdFn }) {
  const { alumnoIds, sustitucionPorAlumnoId, error: visiblesErr } = await resolverAlumnoIdsVisibles(admin, {
    tenantId,
    tenantSlug,
    userId,
    role,
    findProfesorIdFn,
  });
  if (visiblesErr) return { error: visiblesErr };
  // Un profesor con alumnoIds:[] no tiene NINGUNA asignación — se lo
  // decimos explícitamente al frontend (sinAlumnosAsignados) para que
  // pueda distinguir "no tienes alumnos" de "tienes alumnos pero esta
  // semana no hay franjas", en vez de una rejilla vacía sin explicación.
  const sinAlumnosAsignados = alumnoIds !== null && alumnoIds.length === 0;
  // Regla de seguridad innegociable: un profesor sin ninguna asignación
  // devuelve lista vacía, NUNCA cae a la consulta sin filtro de abajo
  // (mismo antipatrón que el bug de aislamiento de GET /api/v1/tasks).
  if (sinAlumnosAsignados) return { franjas: [], sinAlumnosAsignados };

  let query = admin
    .from("academia_horario")
    .select(
      "id, dia_semana, hora_inicio, hora_fin, fecha_inicio, fecha_fin, " +
        "alumno:academia_alumnos(id, nombre, curso, nivel, activo)"
    )
    .eq("tenant_id", tenantId)
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });
  if (alumnoIds !== null) query = query.in("alumno_id", alumnoIds);

  const { data, error } = await query;
  if (error) return { error };

  const franjas = (data || []).filter((row) => row.alumno?.activo !== false);
  // Marca cada franja cuyo alumno viene por sustitución (nunca por
  // asignación propia, ver resolverAlumnoIdsVisibles) — para la etiqueta
  // "vía sustitución de X" del grid, distinta del color de nivel del
  // borde izquierdo (ver nivel.js/horario.js, no tocarlo).
  const badges = await resolverBadgesSustitucion(admin, sustitucionPorAlumnoId);
  for (const franja of franjas) {
    franja.via_sustitucion = badges.get(franja.alumno.id) || null;
  }
  return { franjas, sinAlumnosAsignados: false };
}

// GET /api/v1/academia/horario — horario semanal. Admin ve todo el
// tenant; profesor ve SOLO las franjas de sus alumnos asignados (ver
// academia_profesor_alumnos, migración 094) — vista personal, no global.
// Devuelve una fila por franja, con el alumno embebido, para que el frontend
// agrupe por día/hora sin tener que hacer una segunda llamada.
export default async function academiaHorarioRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { franjas, sinAlumnosAsignados, error } = await fetchFranjasVisibles(admin, {
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      role: auth.membership.role,
      findProfesorIdFn: findProfesorId,
    });

    if (error) {
      req.log.error({ err: error, requestId }, "academia horario fetch failed");
      return fail(reply, 500, "horario_fetch_failed", "Failed to fetch horario", requestId);
    }

    return ok(reply, { franjas, sin_alumnos_asignados: Boolean(sinAlumnosAsignados) }, requestId);
  });
}
