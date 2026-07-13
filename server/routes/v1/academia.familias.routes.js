import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

// El formulario (familiaFields.js) ya manda null para los campos opcionales
// vacíos, pero el preprocess también acepta "" por si llega así desde
// cualquier otro caller — "" fallaba .email()/.enum() con un 400 confuso.
const vacioAUndefined = (v) => (v === "" ? undefined : v);
// Igual que vacioAUndefined, pero también normaliza null — el email pasa a
// ser obligatorio (ver más abajo), así que "" y null deben caer en el mismo
// required_error que "campo ausente", no en una rama .nullable() aparte.
const emailVacioAUndefined = (v) => (v === "" || v == null ? undefined : v);

// Esta creación de familia SIEMPRE es una acción independiente (ver comentario
// del POST más abajo: nunca va "de paso" con un alta de alumno en borrador),
// así que el email es obligatorio sin excepción — sin él no se le puede
// enviar factura ni informe a esa familia.
export const CreateFamiliaSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.preprocess(
    emailVacioAUndefined,
    z.string({ required_error: "El email de la familia es obligatorio para el envío de facturas e informes" })
      .trim()
      .email()
  ),
  metodo_pago: z.preprocess(
    vacioAUndefined,
    z.enum(["bizum", "domiciliado", "transferencia", "efectivo"]).optional().nullable()
  ),
  codigo_sepa: z.preprocess(vacioAUndefined, z.string().trim().optional().nullable()),
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
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues, body: req.body, requestId }, "academia familias create: invalid body");
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

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
