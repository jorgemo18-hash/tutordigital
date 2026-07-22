import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { INSCRIPCION_CONFIG_DEFAULTS, resolverInscripcionConfig } from "../../lib/academiaConfig/inscripcionConfig.js";
import {
  DEFAULT_TEXTO_COMPLETO,
  DEFAULT_TEXTO_SOLO_RECIBO,
  DEFAULT_TEXTO_SOLO_INFORME,
} from "../../lib/academiaEnvio/textoAcompanamiento.js";

const CONFIG_COLUMNS =
  "franja_inicio, franja_fin, franja_duracion, dias_laborables, nombre_emisor, dni_emisor, " +
  "direccion_emisor, ciudad_emisor, cp_emisor, telefono_emisor, email_emisor, iban, bizum_emisor, " +
  "concepto_recibo_plantilla, logo_url, bg_url, enviar_recibo_al_pagar, desglose_iva, " +
  "inscripcion_config, email_texto_completo, email_texto_solo_recibo, email_texto_solo_informe";

const DEFAULTS = {
  franja_inicio: "09:00",
  franja_fin: "21:00",
  franja_duracion: 60,
  dias_laborables: [1, 2, 3, 4, 5],
  concepto_recibo_plantilla: "Clases {mes} {año}",
  logo_url: null,
  bg_url: null,
  enviar_recibo_al_pagar: false,
  desglose_iva: false,
  inscripcion_config: INSCRIPCION_CONFIG_DEFAULTS,
  email_texto_completo: DEFAULT_TEXTO_COMPLETO,
  email_texto_solo_recibo: DEFAULT_TEXTO_SOLO_RECIBO,
  email_texto_solo_informe: DEFAULT_TEXTO_SOLO_INFORME,
};

// inscripcion_config: null en la columna (tenant que nunca tocó la
// pestaña Inscripción) siempre debe llegar al frontend ya resuelto con
// los defaults — nunca null, para no repetir esa lógica de merge en cada
// consumidor (ver también generarHojaInscripcion.js, que hace el mismo
// resolve del lado del payload al microservicio).
function resolverConfig(data) {
  const config = data || DEFAULTS;
  return { ...config, inscripcion_config: resolverInscripcionConfig(config.inscripcion_config) };
}

// logo_url/bg_url no se exponen aquí: solo los escriben las rutas de
// upload (ver academia-config/upload.routes.js), nunca a mano por el admin.
// texto_lopd ya no existe — se unificó con "Textos legales" (migración
// 066, ver academia.textos-legales.routes.js). texto_exencion_iva tampoco
// — el PDF/email de recibo leen ya solo de academia_textos_legales (tipo
// "recibos", ver academiaInformes/payload.js y academiaRecibos/enviar.js);
// la columna en sí sigue en la tabla hasta que se aplique la migración de
// borrado (pendiente de verificación en producción). alquiler_base_mensual/
// nominas_config (de un diseño anterior de la pestaña Fiscal) ya no se
// leen/escriben aquí — esos valores ahora viven por período en
// academia_fiscal_trimestres (ver fiscalTrimestresStore.js); las columnas
// siguen en la tabla pero quedan sin usar.

// El PUT de inscripcion_config siempre espera el objeto completo (los 5
// bloques con todas sus claves) — el frontend (camposPanel.js) lo arma
// así a partir de lo que ya tenía cargado + el toggle que cambió, nunca
// manda un parche parcial, así que no hace falta merge en el backend.
const InscripcionConfigSchema = z.object({
  alumno: z.object({
    fecha_nacimiento: z.boolean(),
    dni: z.boolean(),
    curso: z.boolean(),
    email: z.boolean(),
    telefono: z.boolean(),
  }),
  familia: z.object({
    activo: z.boolean(),
    nombre_tutor: z.boolean(),
    apellidos: z.boolean(),
    dni: z.boolean(),
    direccion: z.boolean(),
    codigo_postal: z.boolean(),
    telefono: z.boolean(),
    email: z.boolean(),
  }),
  metodo_pago: z.object({
    activo: z.boolean(),
    domiciliado: z.boolean(),
    transferencia: z.boolean(),
    bizum: z.boolean(),
    efectivo: z.boolean(),
  }),
  preferencia_cobro: z.object({
    activo: z.boolean(),
  }),
  autorizaciones: z.object({
    activo: z.boolean(),
    salida_sin_acompanante: z.boolean(),
  }),
});

const UpdateConfigSchema = z.object({
  concepto_recibo_plantilla: z.string().trim().min(1).optional(),
  dias_laborables: z.array(z.number().int().min(1).max(7)).optional(),
  nombre_emisor: z.string().trim().optional(),
  dni_emisor: z.string().trim().optional(),
  direccion_emisor: z.string().trim().optional(),
  telefono_emisor: z.string().trim().optional(),
  bizum_emisor: z.string().trim().optional(),
  email_emisor: z.string().trim().optional(),
  iban: z.string().trim().optional(),
  enviar_recibo_al_pagar: z.boolean().optional(),
  desglose_iva: z.boolean().optional(),
  inscripcion_config: InscripcionConfigSchema.optional(),
  email_texto_completo: z.string().trim().optional(),
  email_texto_solo_recibo: z.string().trim().optional(),
  email_texto_solo_informe: z.string().trim().optional(),
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

    return ok(reply, { config: resolverConfig(data) }, requestId);
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
    return ok(reply, { config: resolverConfig(data) }, requestId);
  });
}
