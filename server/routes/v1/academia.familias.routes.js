import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const CreateFamiliaSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  metodo_pago: z.enum(["bizum", "domiciliado", "transferencia", "efectivo"]).optional().nullable(),
  codigo_sepa: z.string().trim().optional().nullable(),
});

// GET /api/v1/academia/familias — listado mínimo (id, nombre, email,
// metodo_pago) para el buscador "Vincular a hermano/a" del drawer de
// alumnos. El detalle completo de una familia viaja embebido en
// GET /academia/alumnos/:id.
export default async function academiaFamiliasRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_familias")
      .select("id, nombre, email, metodo_pago")
      .eq("tenant_id", auth.tenant.id)
      .eq("activa", true)
      .order("nombre", { ascending: true });

    if (error) {
      req.log.error({ err: error, requestId }, "academia familias fetch failed");
      return fail(reply, 500, "familias_fetch_failed", "Failed to fetch familias", requestId);
    }
    return ok(reply, { familias: data || [] }, requestId);
  });

  // POST /api/v1/academia/familias — crea una familia de forma aislada
  // (sin alumno todavía), usada por el drawer "Seleccionar familia" del
  // drawer de alumno: crear y vincular ya no se hacen en el mismo paso
  // que guardar el alumno.
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = CreateFamiliaSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_familias")
      .insert({ tenant_id: auth.tenant.id, activa: true, ...parsed.data })
      .select("id, nombre, email, metodo_pago")
      .single();

    if (error) {
      req.log.error({ err: error, requestId }, "academia familias create failed");
      return fail(reply, 500, "familia_create_failed", "Failed to create familia", requestId);
    }
    return created(reply, { familia: data }, requestId);
  });
}
