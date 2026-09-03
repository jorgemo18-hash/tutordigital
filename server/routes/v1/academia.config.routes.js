import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { asegurarFichaProfesorDeAdmin } from "../../lib/academiaProfesores/fichaAdmin.js";
import { INSCRIPCION_CONFIG_DEFAULTS, resolverInscripcionConfig } from "../../lib/academiaConfig/inscripcionConfig.js";
import {
  DEFAULT_TEXTO_COMPLETO,
  DEFAULT_TEXTO_SOLO_RECIBO,
  DEFAULT_TEXTO_SOLO_INFORME,
} from "../../lib/academiaEnvio/textoAcompanamiento.js";
import { fetchImpactoHorario } from "../../lib/academiaConfig/horarioImpacto.js";
import { HORA_RE } from "../../lib/academiaAlumnoSchemas.js";
import { normalizarPrecios } from "../../../assets/shared/js/preciosPublicos.js";

// La lista de precios entra como objeto libre y sale saneada: la forma
// canónica la decide preciosPublicos.js, que es el mismo módulo que usa el
// editor, para que no haya dos ideas distintas de qué es una tabla válida.
const PreciosPublicosSchema = z.object({}).passthrough().transform(normalizarPrecios);

const CONFIG_COLUMNS =
  "franja_inicio, franja_fin, franja_inicio_2, franja_fin_2, franja_duracion, dias_laborables, nombre_emisor, dni_emisor, " +
  "direccion_emisor, ciudad_emisor, cp_emisor, telefono_emisor, email_emisor, iban, bizum_emisor, " +
  "concepto_recibo_plantilla, logo_url, bg_url, enviar_recibo_al_pagar, desglose_iva, " +
  "inscripcion_config, email_texto_completo, email_texto_solo_recibo, email_texto_solo_informe, " +
  "control_horario_activo, acceso_tutor_activo, max_alumnos_por_franja, admin_imparte_clases, precios_publicos";

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
  control_horario_activo: false,
  acceso_tutor_activo: false,
  admin_imparte_clases: false,
  // null = sin límite de plazas por franja (ver migración 106).
  max_alumnos_por_franja: null,
  // null = el centro nunca abrió Ajustes › Precios (migración 112). Se deja
  // null a propósito en vez de sembrar la tabla de ejemplo aquí: es lo que
  // distingue "aún no lo he puesto" de "lo he vaciado", y la hoja de
  // familias sale solo con el horario mientras siga a null.
  precios_publicos: null,
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

// Exportados (no solo internos) para poder testear la validación de
// franja_inicio/franja_fin/franja_duracion directamente: sin sesión real
// no hay forma de llegar a esta validación vía HTTP (requireRole corta
// antes con 401), mismo motivo por el que sustituciones.routes.js exporta
// ROLES_CREAR/ROLES_REVOCAR en vez de solo probarlos vía app.inject.
export const UpdateConfigSchema = z.object({
  concepto_recibo_plantilla: z.string().trim().min(1).optional(),
  dias_laborables: z.array(z.number().int().min(1).max(7)).optional(),
  // Franjas horarias (Ajustes › Horario) — un solo modelo de escalares,
  // decisión de producto 2026-07-31 (ver docs/deuda-tecnica.md): no hay
  // tabla de tramos irregulares. franja_duracion en minutos, acotada a un
  // rango razonable (no se valida aquí que inicio<fin, eso lo decide el
  // impacto en /impacto-horario antes de guardar).
  franja_inicio: z.string().regex(HORA_RE).optional(),
  franja_fin: z.string().regex(HORA_RE).optional(),
  // Segundo tramo de apertura (jornada partida, migración 111). null lo
  // vacía explícitamente = jornada continua. La coherencia entre los dos
  // (o los dos, o ninguno; y el segundo después del primero) se comprueba
  // más abajo, con superRefine, para poder decirlo en castellano en vez de
  // devolver un CHECK de Postgres.
  franja_inicio_2: z.string().regex(HORA_RE).nullable().optional(),
  franja_fin_2: z.string().regex(HORA_RE).nullable().optional(),
  franja_duracion: z.number().int().min(15).max(240).optional(),
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
  control_horario_activo: z.boolean().optional(),
  // Apagado (por defecto) el alta de alumno no exige email, no crea cuenta
  // en auth.users y no envía la invitación al tutor — ver migración 105.
  acceso_tutor_activo: z.boolean().optional(),
  admin_imparte_clases: z.boolean().optional(),
  // Plazas por franja. null lo vacía explícitamente (= sin límite); el tope
  // de 99 es un guardarraíl contra un dedazo, no una regla de negocio.
  max_alumnos_por_franja: z.number().int().min(1).max(99).nullable().optional(),
  // Lista de precios pública (migración 112). Se acepta el objeto tal cual
  // lo manda el editor y se SANEA aquí con la misma función que usa el
  // frontend: ids duplicados, precios huérfanos de una fila ya borrada y
  // textos de trescientos caracteres se corrigen en vez de rechazarse, para
  // que un jsonb heredado no bloquee el guardado del resto de Ajustes.
  precios_publicos: PreciosPublicosSchema.optional(),
}).superRefine((datos, ctx) => {
  const tiene = (v) => v !== undefined && v !== null && v !== "";
  const inicio2 = datos.franja_inicio_2;
  const fin2 = datos.franja_fin_2;
  // Medio tramo guardado es peor que ninguno: la rejilla lo ignoraría y el
  // admin creería tener abierto un horario que no existe.
  if (tiene(inicio2) !== tiene(fin2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["franja_fin_2"],
      message: "El segundo tramo necesita hora de apertura Y de cierre.",
    });
    return;
  }
  if (!tiene(inicio2)) return;
  const min = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  if (min(fin2) <= min(inicio2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["franja_fin_2"],
      message: "El segundo tramo tiene que cerrar después de abrir.",
    });
  }
  if (tiene(datos.franja_fin) && min(inicio2) < min(datos.franja_fin)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["franja_inicio_2"],
      message: "El segundo tramo tiene que empezar después de que cierre el primero.",
    });
  }
});

// Query string: todo llega como texto (Fastify no castea), franja_duracion
// necesita coerción explícita a número antes de min/max.
export const ImpactoHorarioQuerySchema = z.object({
  franja_inicio: z.string().regex(HORA_RE),
  franja_fin: z.string().regex(HORA_RE),
  // Opcionales: un centro de jornada continua no los manda (migración 111).
  franja_inicio_2: z.string().regex(HORA_RE).optional(),
  franja_fin_2: z.string().regex(HORA_RE).optional(),
  franja_duracion: z.coerce.number().int().min(15).max(240),
});

// GET /api/v1/academia/config — franjas, días laborables y datos de
// facturación del centro. Si el tenant aún no tiene fila en academia_config,
// devuelve los valores por defecto de la tabla en vez de 404.
export default async function academiaConfigRoutes(app, { asegurarFichaProfesorDeAdminFn = asegurarFichaProfesorDeAdmin } = {}) {
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

  // GET /api/v1/academia/config/impacto-horario — cuántas filas de
  // academia_horario dejarían de tener un hora_inicio válido si se
  // guardaran estos franja_inicio/franja_fin/franja_duracion. Admin-only,
  // de solo lectura (no persiste nada) — el panel lo consulta antes de
  // guardar de verdad, para avisar del aviso de huérfanos.
  app.get("/impacto-horario", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = ImpactoHorarioQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    // franja_duracion se sigue aceptando en la query (el panel la manda y
    // los dos no se despliegan a la vez) pero ya NO entra en el cálculo:
    // desde que la rejilla va por medias horas, la duración estándar de una
    // clase no descoloca ninguna clase existente. Ver horarioTramos.js.
    const { huerfanos, error } = await fetchImpactoHorario(admin, auth.tenant.id, {
      franja_inicio: parsed.data.franja_inicio,
      franja_fin: parsed.data.franja_fin,
      franja_inicio_2: parsed.data.franja_inicio_2 || null,
      franja_fin_2: parsed.data.franja_fin_2 || null,
    });
    if (error) {
      req.log.error({ err: error, requestId }, "academia config impacto horario failed");
      return fail(reply, 500, "impacto_horario_failed", "No se pudo calcular el impacto en el horario.", requestId);
    }
    return ok(reply, { huerfanos }, requestId);
  });

  // PUT /api/v1/academia/config — expone también franja_inicio/franja_fin/
  // franja_duracion (Ajustes › Horario) además de Recibos; el resto de
  // columnas se gestionan desde otras rutas.
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

    // Encender "el administrador da clase" le crea ficha de profesor: sin
    // ella no se le pueden asignar alumnos, y sin asignaciones la sección
    // "Dar clase" sale vacía (ver fichaAdmin.js). Se hace aquí, con el
    // interruptor, y no en una pantalla aparte, porque es la consecuencia
    // mecánica de lo que el admin acaba de decidir, no otra decisión.
    //
    // Apagarlo NO borra ni desactiva la ficha: se llevaría por delante las
    // asignaciones y el histórico. La sección simplemente deja de verse.
    //
    // Y no puede tumbar el guardado: la configuración ya está escrita. Si
    // la ficha falla se devuelve un aviso y el admin puede crearla a mano
    // desde Profesores.
    let avisoFicha = null;
    if (parsed.data.admin_imparte_clases === true) {
      const ficha = await asegurarFichaProfesorDeAdminFn(admin, {
        tenantId: auth.tenant.id,
        tenantSlug: auth.tenant.slug,
        userId: auth.user.id,
        email: auth.user.email,
        // auth.user es el usuario de Supabase Auth: el nombre, si existe,
        // viaja en user_metadata. Si no hay ninguno, fichaAdmin cae al email.
        displayName: auth.user.user_metadata?.display_name || auth.user.user_metadata?.full_name,
      });
      if (!ficha.ok) {
        req.log.error({ err: ficha.error, code: ficha.code, requestId }, "academia config: ficha de profesor del admin falló");
        avisoFicha = "Se guardó el ajuste, pero no se pudo crear tu ficha de profesor. Créala a mano desde Profesores.";
      }
    }

    return ok(reply, { config: resolverConfig(data), ...(avisoFicha ? { aviso: avisoFicha } : {}) }, requestId);
  });
}
