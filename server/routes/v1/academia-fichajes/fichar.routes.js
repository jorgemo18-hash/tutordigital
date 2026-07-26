import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { registrarFichaje } from "../../../lib/academiaFichajes/fichar.js";
import { fetchEstadoActual } from "../../../lib/academiaFichajes/consultas.js";
import { compactSupabaseError } from "../../../lib/adminTeacherHelpers.js";

const FicharBodySchema = z.object({ tipo: z.enum(["entrada", "salida"]) });

// Self-fichaje: admin y teacher (no hay rol "recepción" aparte — el
// personal de recepción de la academia usa 'admin', ver migración 093).
export default async function academiaFichajesFicharRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // POST /api/v1/academia/fichajes/fichar — el trabajador ficha por sí
  // mismo. worker_profile_id sale SIEMPRE de la sesión (auth.user.id),
  // nunca del body: nadie puede fichar por otro.
  app.post("/fichar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = FicharBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const resultado = await registrarFichaje(admin, {
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      workerProfileId: auth.user.id,
      tipo: parsed.data.tipo,
    });
    if (!resultado.ok) {
      // supabaseError es lo que de verdad dice Postgres/PostgREST (code/
      // message/hint) — resultado.motivo es solo el texto genérico de cara
      // al usuario, no sirve para diagnosticar (mismo bug que tenía
      // findProfesorId: sin esto, un 500 no deja ningún rastro real).
      req.log.error(
        { err: resultado, supabaseError: compactSupabaseError(resultado.error), requestId },
        "academia fichajes fichar failed"
      );
      return fail(reply, 500, resultado.code || "fichaje_failed", resultado.motivo, requestId);
    }
    return ok(reply, { fichaje: resultado.fichaje }, requestId);
  });

  // GET /api/v1/academia/fichajes/mi-estado — "¿estoy dentro o fuera ahora
  // mismo?", para el botón del panel del propio trabajador.
  app.get("/mi-estado", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { dentro, ultimoTipo, ultimoTimestamp, haFichadoEntradaHoy, error } = await fetchEstadoActual(admin, auth.tenant.id, auth.user.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia fichajes mi-estado failed");
      return fail(reply, 500, "estado_fetch_failed", "No se pudo comprobar el estado.", requestId);
    }
    return ok(reply, { dentro, ultimoTipo, ultimoTimestamp, haFichadoEntradaHoy }, requestId);
  });
}
