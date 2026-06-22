import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

// GET /api/v1/academia/horario — horario semanal (admin lee/escribe, profesor solo lee).
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
    const { data, error } = await admin
      .from("academia_horario")
      .select(
        "id, dia_semana, hora_inicio, hora_fin, fecha_inicio, fecha_fin, " +
          "alumno:academia_alumnos(id, nombre, curso, nivel, activo)"
      )
      .eq("tenant_id", auth.tenant.id)
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) {
      req.log.error({ err: error, requestId }, "academia horario fetch failed");
      return fail(reply, 500, "horario_fetch_failed", "Failed to fetch horario", requestId);
    }

    const franjas = (data || []).filter((row) => row.alumno?.activo !== false);
    return ok(reply, { franjas }, requestId);
  });
}
