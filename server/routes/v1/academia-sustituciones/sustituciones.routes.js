import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, created, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import {
  fetchSustitucionesDelTenant,
  fetchMisSustitucionesActivas,
  fetchProfesoresParaSelector,
} from "../../../lib/academiaSustituciones/consultas.js";
import { crearSustitucion, revocarSustitucion } from "../../../lib/academiaSustituciones/gestion.js";
import { resolverParametrosCreacion } from "../../../lib/academiaSustituciones/reglasCreacion.js";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Duplicado a propósito desde academia.sesiones.routes.js (mismo criterio
// ya documentado en academia.notas-examen.routes.js y academia.horario.routes.js).
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

const CrearSustitucionSchema = z.object({
  profesor_sustituto_id: z.string().uuid().optional(),
  profesor_sustituido_id: z.string().uuid(),
  fecha_inicio: z.string().regex(FECHA_RE).optional(),
  fecha_fin: z.string().regex(FECHA_RE).optional(),
});

const CODE_STATUS = {
  mismo_profesor: 422,
  rango_invalido: 422,
  profesor_not_found: 404,
  no_perfil_profesor: 403,
  solo_autodeclaracion: 403,
  solo_hoy: 403,
  invalid_body: 400,
  not_found: 404,
  ya_revocada: 409,
  no_es_tu_sustitucion: 403,
  solo_autodeclaradas: 403,
};

// Registrado bajo prefix /api/v1/academia/sustituciones (ver server/app.js).
export default async function academiaSustitucionesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /academia/sustituciones/profesores — selector "¿a quién
  // sustituyes?" (profesor) / "sustituto y sustituido" (admin). Un
  // profesor nunca se ve a sí mismo en la lista: no puede sustituirse.
  app.get("/profesores", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    let excluirProfesorId;
    if (auth.membership.role === "teacher") {
      excluirProfesorId = await findProfesorId(admin, auth.tenant.slug, auth.user.id);
    }
    const { profesores, error } = await fetchProfesoresParaSelector(admin, { tenantSlug: auth.tenant.slug, excluirProfesorId });
    if (error) {
      req.log.error({ err: error, requestId }, "academia sustituciones profesores failed");
      return fail(reply, 500, "profesores_fetch_failed", "No se pudieron cargar los profesores.", requestId);
    }
    return ok(reply, { profesores }, requestId);
  });

  // GET /academia/sustituciones — admin: histórico completo del tenant;
  // profesor: solo sus sustituciones ACTIVAS (como sustituto o sustituido).
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();

    if (auth.membership.role === "admin") {
      const { sustituciones, error } = await fetchSustitucionesDelTenant(admin, auth.tenant.id);
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

  // POST /academia/sustituciones — un profesor solo puede autodeclararse
  // a sí mismo como sustituto, y solo para HOY (fecha_inicio=fecha_fin=
  // hoy) — cualquier otro rango u otro sustituto -> 403. El admin puede
  // declarar cualquier rango, con cualquier profesor como sustituto.
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = CrearSustitucionSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const body = parsed.data;

    const admin = createSupabaseAdmin();
    const miProfesorId = auth.membership.role === "teacher"
      ? await findProfesorId(admin, auth.tenant.slug, auth.user.id)
      : null;

    const parametros = resolverParametrosCreacion({
      role: auth.membership.role, miProfesorId, body, hoyISO: hoyISO(),
    });
    if (!parametros.ok) {
      const status = CODE_STATUS[parametros.code] || 400;
      return fail(reply, status, parametros.code, "No se pudo crear la sustitución.", requestId);
    }

    const resultado = await crearSustitucion(admin, {
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      profesorSustitutoId: parametros.profesorSustitutoId,
      profesorSustituidoId: body.profesor_sustituido_id,
      fechaInicio: parametros.fechaInicio,
      fechaFin: parametros.fechaFin,
      declaradaPor: auth.user.id,
      origen: parametros.origen,
    });
    if (!resultado.ok) {
      const status = CODE_STATUS[resultado.code] || 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia sustituciones crear failed");
      return fail(reply, status, resultado.code, "No se pudo crear la sustitución.", requestId);
    }
    return created(reply, { sustitucion: resultado.sustitucion }, requestId);
  });

  // POST /academia/sustituciones/:id/revocar — admin: cualquiera. Un
  // profesor solo puede deshacer una suya, autodeclarada por él mismo —
  // nunca una del admin ni la de otro profesor (ver reglasRevocacion.js,
  // que aplica revocarSustitucion). Ahí vive la regla real; aquí solo se
  // resuelve el profesorId cuando hace falta.
  app.post("/:id/revocar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const profesorId = auth.membership.role === "teacher"
      ? await findProfesorId(admin, auth.tenant.slug, auth.user.id)
      : null;

    const sustitucionId = String(req.params?.id || "").trim();
    const resultado = await revocarSustitucion(admin, {
      tenantId: auth.tenant.id, sustitucionId, revocadaPor: auth.user.id,
      role: auth.membership.role, profesorId,
    });
    if (!resultado.ok) {
      const status = CODE_STATUS[resultado.code] || 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia sustituciones revocar failed");
      return fail(reply, status, resultado.code, "No se pudo revocar la sustitución.", requestId);
    }
    return ok(reply, { revocada: true }, requestId);
  });
}
