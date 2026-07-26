import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, created, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchSustitucionesDelTenant, fetchMisSustitucionesActivas, fetchProfesoresParaSelector } from "../../../lib/academiaSustituciones/consultas.js";
import { crearSustitucion, revocarSustitucion } from "../../../lib/academiaSustituciones/gestion.js";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Duplicado a propósito desde academia.sesiones.routes.js (mismo criterio
// ya documentado en academia.notas-examen.routes.js y academia.horario.routes.js)
// — solo hace falta aquí para GET / cuando el que pregunta es un profesor.
async function findProfesorId(admin, tenantSlug, userId) {
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id || null;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Todos obligatorios: solo el admin llega aquí (ver roles:["admin"] en
// el POST de abajo) — ya no hay autodeclaración con fechas implícitas.
const CrearSustitucionSchema = z.object({
  profesor_sustituto_id: z.string().uuid(),
  profesor_sustituido_id: z.string().uuid(),
  fecha_inicio: z.string().regex(FECHA_RE),
  fecha_fin: z.string().regex(FECHA_RE),
});

const CODE_STATUS = {
  mismo_profesor: 422,
  rango_invalido: 422,
  profesor_not_found: 404,
  not_found: 404,
  ya_revocada: 409,
  solape: 409,
  finalizada: 422,
};

const CODE_MESSAGE = {
  solape: "Ya existe una sustitución activa para ese profesor en esas fechas.",
  ya_revocada: "Esta sustitución ya estaba revocada.",
  finalizada: "No se puede revocar una sustitución ya finalizada: su rango de fechas ya ha pasado.",
};

// Exportadas (en vez de literales inline) para que un test pueda fijar
// esta decisión de seguridad sin depender de auth real ni de Fastify —
// ver academia-sustituciones-routes-wiring.test.mjs: si alguien
// reintrodujera "teacher" aquí, ese test lo detectaría sin necesitar
// una sesión de profesor de verdad.
export const ROLES_CREAR = ["admin"];
export const ROLES_REVOCAR = ["admin"];

// Registrado bajo prefix /api/v1/academia/sustituciones (ver server/app.js).
// Gestión (crear/revocar) exclusiva del admin — un profesor solo puede
// CONSULTAR las suyas (GET /). Sin excepciones ni autodeclaración: un
// intento de POST o de revocar desde rol teacher siempre es 403, lo
// pida por donde lo pida (UI o llamada directa a la API).
export default async function academiaSustitucionesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /academia/sustituciones/profesores — selector de sustituto/
  // sustituido del formulario de creación del admin. Admin-only: el
  // profesor ya no tiene ningún formulario que lo necesite.
  app.get("/profesores", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { profesores, error } = await fetchProfesoresParaSelector(admin, { tenantSlug: auth.tenant.slug });
    if (error) {
      req.log.error({ err: error, requestId }, "academia sustituciones profesores failed");
      return fail(reply, 500, "profesores_fetch_failed", "No se pudieron cargar los profesores.", requestId);
    }
    return ok(reply, { profesores }, requestId);
  });

  // GET /academia/sustituciones — admin: histórico completo del tenant;
  // profesor: solo sus sustituciones ACTIVAS (como sustituto o sustituido)
  // — sigue siendo de solo lectura, sin cambios respecto a antes.
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();

    if (auth.membership.role === "admin") {
      const { sustituciones, error } = await fetchSustitucionesDelTenant(admin, auth.tenant.id, auth.tenant.slug);
      if (error) {
        req.log.error({ err: error, requestId }, "academia sustituciones listado admin failed");
        return fail(reply, 500, "sustituciones_fetch_failed", "No se pudieron cargar las sustituciones.", requestId);
      }
      return ok(reply, { sustituciones }, requestId);
    }

    const profesorId = await findProfesorId(admin, auth.tenant.slug, auth.user.id);
    if (!profesorId) return ok(reply, { sustituciones: [] }, requestId);
    const { sustituciones, error } = await fetchMisSustitucionesActivas(admin, {
      tenantId: auth.tenant.id, profesorId, hoyISO: hoyISO(),
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia sustituciones listado profesor failed");
      return fail(reply, 500, "sustituciones_fetch_failed", "No se pudieron cargar tus sustituciones.", requestId);
    }
    return ok(reply, { sustituciones }, requestId);
  });

  // POST /academia/sustituciones — admin-only, cualquier rango de fechas.
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ROLES_CREAR });
    if (!auth.ok) return;

    const parsed = CrearSustitucionSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const body = parsed.data;

    const admin = createSupabaseAdmin();
    const resultado = await crearSustitucion(admin, {
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      profesorSustitutoId: body.profesor_sustituto_id,
      profesorSustituidoId: body.profesor_sustituido_id,
      fechaInicio: body.fecha_inicio,
      fechaFin: body.fecha_fin,
      declaradaPor: auth.user.id,
      origen: "admin",
    });
    if (!resultado.ok) {
      const status = CODE_STATUS[resultado.code] || 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia sustituciones crear failed");
      return fail(reply, status, resultado.code, CODE_MESSAGE[resultado.code] || "No se pudo crear la sustitución.", requestId);
    }
    return created(reply, { sustitucion: resultado.sustitucion }, requestId);
  });

  // POST /academia/sustituciones/:id/revocar — admin-only, cualquier
  // sustitución del tenant.
  app.post("/:id/revocar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ROLES_REVOCAR });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const sustitucionId = String(req.params?.id || "").trim();
    const resultado = await revocarSustitucion(admin, {
      tenantId: auth.tenant.id, sustitucionId, revocadaPor: auth.user.id, hoyISO: hoyISO(),
    });
    if (!resultado.ok) {
      const status = CODE_STATUS[resultado.code] || 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia sustituciones revocar failed");
      return fail(reply, status, resultado.code, CODE_MESSAGE[resultado.code] || "No se pudo revocar la sustitución.", requestId);
    }
    return ok(reply, { revocada: true }, requestId);
  });
}
