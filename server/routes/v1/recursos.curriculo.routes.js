import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { listaDeMaterias, curriculoDeCurso } from "../../lib/curriculo/curriculoAragon.js";

// RECURSOS → CURRÍCULO: el currículo oficial de ESO de Aragón para consultar
// (ver server/lib/curriculo/curriculoAragon.js).
//   GET /api/v1/recursos/curriculo                 las materias
//   GET /api/v1/recursos/curriculo/:materia?curso=  una materia, un curso
// Es texto público (el BOA): se pide sesión igualmente, como todo Recursos.
export const ROLES = ["teacher", "admin"];

const Consulta = z.object({ curso: z.coerce.number().int().min(1).max(4).optional() });

export default async function recursosCurriculoRoutes(app) {
  const guard = makeTenantMembershipGuard();

  async function autoriza(req, reply) {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ROLES });
    return { requestId, ok: auth.ok };
  }

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const { requestId, ok: autorizado } = await autoriza(req, reply);
    if (!autorizado) return;
    return ok(reply, { materias: listaDeMaterias() }, requestId);
  });

  app.get("/:materia", { preHandler: guard.preHandler }, async (req, reply) => {
    const { requestId, ok: autorizado } = await autoriza(req, reply);
    if (!autorizado) return;
    const q = Consulta.safeParse(req.query || {});
    if (!q.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId);
    const datos = curriculoDeCurso(req.params.materia, q.data.curso ?? null);
    if (!datos) return fail(reply, 404, "materia_no_encontrada", "Esa materia no está en el currículo", requestId);
    return ok(reply, datos, requestId);
  });
}
