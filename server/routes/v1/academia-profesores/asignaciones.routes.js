import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import {
  fetchAlumnosActivosDelTenant,
  fetchAlumnosDeProfesor,
  asignarAlumno,
  quitarAlumno,
} from "../../../lib/academiaProfesores/asignaciones.js";

const AsignarBodySchema = z.object({ alumno_id: z.string().uuid() });

// Registrado bajo prefix /api/v1/academia/profesores (ver server/app.js).
// Solo admin: quién lleva a quién lo decide el centro, no el propio
// profesor. Un profesor sí puede LEER su propia lista (RLS de la
// migración 094 lo permite), pero no hay ruta hoy que lo exponga porque
// no hay todavía ninguna vista de profesor que la necesite (ver la
// auditoría de horario/diario — esa es la pieza que falta construir).
export default async function academiaProfesoresAsignacionesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/alumnos-disponibles", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { alumnos, error } = await fetchAlumnosActivosDelTenant(admin, auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia profesores alumnos-disponibles failed");
      return fail(reply, 500, "alumnos_fetch_failed", "No se pudieron cargar los alumnos.", requestId);
    }
    return ok(reply, { alumnos }, requestId);
  });

  app.get("/:profesorId/alumnos", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const profesorId = String(req.params?.profesorId || "").trim();
    const admin = createSupabaseAdmin();
    const { alumnos, error } = await fetchAlumnosDeProfesor(admin, auth.tenant.id, profesorId);
    if (error) {
      req.log.error({ err: error, requestId }, "academia profesores alumnos-asignados failed");
      return fail(reply, 500, "alumnos_fetch_failed", "No se pudieron cargar los alumnos del profesor.", requestId);
    }
    return ok(reply, { alumnos }, requestId);
  });

  app.post("/:profesorId/alumnos", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const profesorId = String(req.params?.profesorId || "").trim();
    const parsed = AsignarBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const resultado = await asignarAlumno(admin, {
      tenantId: auth.tenant.id, profesorId, alumnoId: parsed.data.alumno_id,
    });
    if (!resultado.ok) {
      const status = resultado.code === "alumno_not_found" ? 404 : 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia profesores asignar failed");
      return fail(reply, status, resultado.code, "No se pudo asignar el alumno.", requestId);
    }
    return ok(reply, { asignado: true }, requestId);
  });

  app.delete("/:profesorId/alumnos/:alumnoId", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const profesorId = String(req.params?.profesorId || "").trim();
    const alumnoId = String(req.params?.alumnoId || "").trim();
    const admin = createSupabaseAdmin();
    const resultado = await quitarAlumno(admin, { tenantId: auth.tenant.id, profesorId, alumnoId });
    if (!resultado.ok) {
      req.log.error({ err: resultado, requestId }, "academia profesores quitar failed");
      return fail(reply, 500, resultado.code, "No se pudo quitar el alumno.", requestId);
    }
    return ok(reply, { quitado: true }, requestId);
  });
}
