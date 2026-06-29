import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const CONFIG_COLUMNS =
  "franja_inicio, franja_fin, franja_duracion, dias_laborables, nombre_emisor, dni_emisor, " +
  "direccion_emisor, ciudad_emisor, cp_emisor, telefono_emisor, email_emisor, iban, bizum_emisor, " +
  "concepto_recibo_plantilla, texto_exencion_iva, logo_url, bg_url, enviar_recibo_al_pagar, " +
  "alquiler_base_mensual, nominas_config";

const DEFAULTS = {
  franja_inicio: "09:00",
  franja_fin: "21:00",
  franja_duracion: 60,
  dias_laborables: [1, 2, 3, 4, 5],
  concepto_recibo_plantilla: "Clases {mes} {año}",
  texto_exencion_iva: "Servicio educativo exento de IVA según el artículo 20.Uno.9º de la Ley 37/1992 del IVA.",
  logo_url: null,
  bg_url: null,
  enviar_recibo_al_pagar: false,
  alquiler_base_mensual: 0,
  nominas_config: {},
};

// logo_url/bg_url no se exponen aquí: solo los escriben las rutas de
// upload (ver academia-config/upload.routes.js), nunca a mano por el admin.
// texto_lopd ya no existe — se unificó con "Textos legales" (migración
// 066, ver academia.textos-legales.routes.js).
//
// nominas_config es un mapa "T{trimestre}_{anio}" -> {base, retencion_pct}
// (ver fiscalConsultas.js) y este PUT sobrescribe la columna entera, así
// que para no perder otros trimestres/años ya guardados el frontend debe
// mandar el objeto completo (el que ya recibió de GET /fiscal/111, con la
// clave del trimestre actual actualizada), no solo la entrada que cambia.
const NominaEntrySchema = z.object({
  base: z.number().min(0),
  retencion_pct: z.number().min(0).max(100),
});
const UpdateConfigSchema = z.object({
  concepto_recibo_plantilla: z.string().trim().min(1).optional(),
  texto_exencion_iva: z.string().trim().optional(),
  dias_laborables: z.array(z.number().int().min(1).max(7)).optional(),
  nombre_emisor: z.string().trim().optional(),
  dni_emisor: z.string().trim().optional(),
  direccion_emisor: z.string().trim().optional(),
  telefono_emisor: z.string().trim().optional(),
  bizum_emisor: z.string().trim().optional(),
  email_emisor: z.string().trim().optional(),
  iban: z.string().trim().optional(),
  enviar_recibo_al_pagar: z.boolean().optional(),
  alquiler_base_mensual: z.number().min(0).optional(),
  nominas_config: z.record(z.string(), NominaEntrySchema).optional(),
});

// GET /api/v1/academia/config — franjas, días laborables y datos de
// facturación del centro. Si el tenant aún no tiene fila en academia_config,
// devuelve los valores por defecto de la tabla en vez de 404.
export default async function academiaConfigRoutes(app) {
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
      .from("academia_config")
      .select(CONFIG_COLUMNS)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (error) {
      req.log.error({ err: error, requestId }, "academia config fetch failed");
      return fail(reply, 500, "config_fetch_failed", "Failed to fetch config", requestId);
    }

    return ok(reply, { config: data || DEFAULTS }, requestId);
  });

  // PUT /api/v1/academia/config — de momento solo expone los campos de
  // Ajustes › Recibos; el resto de columnas se gestionan desde otras rutas.
  app.put("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = UpdateConfigSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    if (!Object.keys(parsed.data).length) return fail(reply, 400, "empty_body", "Nothing to update", requestId);

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("academia_config")
      .upsert({ tenant_id: auth.tenant.id, ...parsed.data }, { onConflict: "tenant_id" });
    if (error) {
      req.log.error({ err: error, requestId }, "academia config update failed");
      return fail(reply, 500, "config_update_failed", "Failed to update config", requestId);
    }

    const { data, error: fetchErr } = await admin
      .from("academia_config")
      .select(CONFIG_COLUMNS)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (fetchErr) return fail(reply, 500, "config_fetch_failed", "Failed to fetch updated config", requestId);
    return ok(reply, { config: data || DEFAULTS }, requestId);
  });
}
