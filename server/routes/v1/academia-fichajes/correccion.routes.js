import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { registrarCorreccion } from "../../../lib/academiaFichajes/correccion.js";

const CorreccionBodySchema = z.object({
  worker_profile_id: z.string().uuid(),
  tipo: z.enum(["entrada", "salida"]),
  fichaje_corregido_id: z.string().uuid().nullable().optional(),
  motivo: z.string().trim().min(1, "El motivo es obligatorio."),
});

export default async function academiaFichajesCorreccionRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // POST /api/v1/academia/fichajes/correccion — solo admin. Nunca
  // modifica ni borra el fichaje original: inserta uno nuevo con
  // origen='admin_correccion' (ver registrarCorreccion). corregido_por
  // sale de la sesión (auth.user.id), nunca del body.
  app.post("/correccion", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = CorreccionBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const resultado = await registrarCorreccion(admin, {
      tenantId: auth.tenant.id,
      workerProfileId: parsed.data.worker_profile_id,
      tipo: parsed.data.tipo,
      fichajeCorregidoId: parsed.data.fichaje_corregido_id || null,
      motivo: parsed.data.motivo,
      corregidoPor: auth.user.id,
    });
    if (!resultado.ok) {
      const status = resultado.code === "not_found" ? 404
        : resultado.code === "fichaje_de_otro_trabajador" ? 422
        : resultado.code === "motivo_requerido" || resultado.code === "tipo_invalido" ? 400
        : 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia fichajes correccion failed");
      return fail(reply, status, resultado.code, resultado.motivo, requestId);
    }
    return ok(reply, { fichaje: resultado.fichaje }, requestId);
  });
}
