import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { verificarAlumnoVisible } from "../../lib/academiaProfesores/verificarAlumnoVisible.js";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const NotaQuerySchema = z.object({
  alumno_id: z.string().uuid(),
  fecha_inicio: z.string().regex(FECHA_RE).optional(),
  fecha_fin: z.string().regex(FECHA_RE).optional(),
});

const NotaCreateSchema = z.object({
  alumno_id: z.string().uuid(),
  fecha: z.string().regex(FECHA_RE),
  asignatura: z.string().trim().min(1).max(120),
  tema: z.string().trim().max(500).optional().nullable(),
  nota: z.number().min(0).max(10),
});

const NotaParamsSchema = z.object({ id: z.string().uuid() });

// Duplicado a propósito desde academia.sesiones.routes.js (no exportado ahí):
// es la misma resolución de 6 líneas, y tocar ese archivo para compartirla
// no está dentro del alcance de este cambio. teacher_profiles no tiene
// columna tenant_id — solo tenant_slug (ver 014_admin_teacher_invites.sql)
// — filtrar por tenant_id nunca encontraba nada, bug preexistente
// detectado al auditar el flujo de invitación.
export async function findProfesorId(admin, tenantSlug, userId) {
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id || null;
}

async function assertAlumnoEnTenant(admin, alumnoId, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select("id")
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "alumno_lookup_failed" };
  if (!data) return { ok: false, status: 404, code: "alumno_not_found" };
  return { ok: true };
}

// Filtrado estricto: admin siempre puede; un profesor solo si el alumno
// está en su conjunto visible (asignado directamente o vía sustitución
// activa hoy — ver resolverAlumnoIdsVisibles). Las notas de examen son
// anotaciones del profesor sobre el alumno (alimentan el informe de la
// IA, no son calificaciones oficiales) — un sustituto legítimo debe
// poder escribirlas el día que cubre, de ahí que dependa del mismo
// conjunto visible que horario/diario, no de una regla propia.
export async function assertAlumnoVisible(admin, { tenantId, tenantSlug, userId, role, alumnoId }) {
  const visible = await verificarAlumnoVisible(admin, { tenantId, tenantSlug, userId, role, findProfesorIdFn: findProfesorId, alumnoId });
  if (visible.error) return { ok: false, status: 500, code: "visibilidad_fetch_failed" };
  if (!visible.ok) return { ok: false, status: 403, code: "alumno_no_visible" };
  return { ok: true };
}

export default async function academiaNotasExamenRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/notas-examen?alumno_id=&fecha_inicio=&fecha_fin=
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = NotaQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_query", "alumno_id (uuid) requerido", requestId, { issues: parsed.error.issues });
    }
    const { alumno_id, fecha_inicio, fecha_fin } = parsed.data;

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, alumno_id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);
    const visibleCheck = await assertAlumnoVisible(admin, {
      tenantId: auth.tenant.id, tenantSlug: auth.tenant.slug, userId: auth.user.id, role: auth.membership.role, alumnoId: alumno_id,
    });
    if (!visibleCheck.ok) return fail(reply, visibleCheck.status, visibleCheck.code, "No tienes acceso a este alumno.", requestId);

    let query = admin
      .from("academia_notas_examen")
      .select("id, alumno_id, fecha, asignatura, tema, nota, created_at")
      .eq("tenant_id", auth.tenant.id)
      .eq("alumno_id", alumno_id)
      .order("fecha", { ascending: false });
    if (fecha_inicio) query = query.gte("fecha", fecha_inicio);
    if (fecha_fin) query = query.lte("fecha", fecha_fin);

    const { data, error } = await query;
    if (error) {
      req.log.error({ err: error, requestId }, "academia notas-examen fetch failed");
      return fail(reply, 500, "notas_fetch_failed", "Failed to fetch notas", requestId);
    }
    return ok(reply, { notas: data || [] }, requestId);
  });

  // POST /api/v1/academia/notas-examen
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = NotaCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }
    const { alumno_id, fecha, asignatura, tema, nota } = parsed.data;

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, alumno_id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);
    const visibleCheck = await assertAlumnoVisible(admin, {
      tenantId: auth.tenant.id, tenantSlug: auth.tenant.slug, userId: auth.user.id, role: auth.membership.role, alumnoId: alumno_id,
    });
    if (!visibleCheck.ok) return fail(reply, visibleCheck.status, visibleCheck.code, "No tienes acceso a este alumno.", requestId);

    const profesorId = await findProfesorId(admin, auth.tenant.slug, auth.user.id);

    const { data, error } = await admin
      .from("academia_notas_examen")
      .insert({
        tenant_id: auth.tenant.id,
        alumno_id,
        profesor_id: profesorId,
        fecha,
        asignatura,
        tema: tema || null,
        nota,
      })
      .select("id, alumno_id, fecha, asignatura, tema, nota, created_at")
      .single();

    if (error) {
      req.log.error({ err: error, requestId }, "academia notas-examen create failed");
      return fail(reply, 500, "nota_create_failed", "Failed to create nota", requestId);
    }
    return created(reply, { nota: data }, requestId);
  });

  // DELETE /api/v1/academia/notas-examen/:id
  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsedParams = NotaParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();

    // Hace falta el alumno_id de la nota ANTES de borrar para poder
    // comprobar visibilidad — no se puede filtrar el DELETE directamente
    // por alumno_id sin conocerlo primero.
    const { data: nota, error: lookupErr } = await admin
      .from("academia_notas_examen")
      .select("id, alumno_id")
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (lookupErr) return fail(reply, 500, "nota_lookup_failed", "Failed to lookup nota", requestId);
    if (!nota) return fail(reply, 404, "nota_not_found", "Nota not found", requestId);

    const visibleCheck = await assertAlumnoVisible(admin, {
      tenantId: auth.tenant.id, tenantSlug: auth.tenant.slug, userId: auth.user.id, role: auth.membership.role, alumnoId: nota.alumno_id,
    });
    if (!visibleCheck.ok) return fail(reply, visibleCheck.status, visibleCheck.code, "No tienes acceso a este alumno.", requestId);

    const { data, error } = await admin
      .from("academia_notas_examen")
      .delete()
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id)
      .select("id")
      .maybeSingle();

    if (error) {
      req.log.error({ err: error, requestId }, "academia notas-examen delete failed");
      return fail(reply, 500, "nota_delete_failed", "Failed to delete nota", requestId);
    }
    if (!data) return fail(reply, 404, "nota_not_found", "Nota not found", requestId);
    return ok(reply, { deleted: true, id: data.id }, requestId);
  });
}
