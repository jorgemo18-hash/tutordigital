import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { enviarInformeDeAlumno } from "../../lib/academiaEnvio/enviarInformeIndividual.js";
import { generarYGuardarComentario } from "../../lib/academiaInformes/generarInforme.js";
import { editarComentarioInforme } from "../../lib/academiaInformes/editarComentario.js";
import { fetchInformePreview } from "../../lib/academiaInformes/preview.js";
import { fetchInformeExistente } from "../../lib/academiaInformes/consultas.js";
import { evaluarConfirmacionInformes } from "../../lib/academiaInformes/confirmacionRegenerar.js";
import { fetchFamiliasConAlumnos, fetchInformesEnviadosMes } from "../../lib/academiaRecibos/consultas.js";
import { getPdfServiceUrl } from "../../lib/pdfService/url.js";

const AlumnoIdParamsSchema = z.object({ alumno_id: z.string().uuid() });
const MesAnioQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});
const GenerarInformeBodySchema = z.object({
  alumno_id: z.string().uuid(),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  forzar: z.boolean().optional().default(false),
  confirmar: z.boolean().optional().default(false),
});
const PeriodoInformesBodySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  confirmar: z.boolean().optional().default(false),
});
const EditarComentarioBodySchema = z.object({
  alumno_id: z.string().uuid(),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  comentario: z.string().trim().min(1).max(4000),
});
const EnviarInformeBodySchema = z.object({
  alumno_id: z.string().uuid(),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  confirmar: z.boolean().optional().default(false),
});

const CODES = {
  not_found: [404, "alumno_not_found"],
  sin_email: [422, "familia_sin_email"],
  sin_sesiones: [422, "sin_sesiones"],
  comentario_failed: [502, "comentario_failed"],
  pdf_service_unreachable: [502, "pdf_service_unreachable"],
  pdf_service_failed: [502, "pdf_service_failed"],
  pdf_failed: [502, "pdf_failed"],
};

function requireApiKey(reply, requestId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) fail(reply, 500, "missing_key", "AI service not configured", requestId);
  return apiKey;
}

// Rutas del informe mensual por alumno — ver server/lib/academiaInformes/
// (un módulo por responsabilidad: preview de solo lectura, generar/guardar
// el comentario con Claude, editarlo a mano, y enviarlo por email).
export default async function academiaInformesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/informes/:alumno_id?mes=&anio= — solo lectura:
  // días del mes + comentario ya guardado (si existe), para poblar la tab
  // "Informe" al seleccionar una familia.
  app.get("/informes/:alumno_id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = AlumnoIdParamsSchema.safeParse(req.params || {});
    const parsedQuery = MesAnioQuerySchema.safeParse(req.query || {});
    if (!parsedParams.success || !parsedQuery.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId);

    const admin = createSupabaseAdmin();
    const preview = await fetchInformePreview(admin, auth.tenant.id, parsedParams.data.alumno_id, parsedQuery.data);
    if (preview.error) {
      req.log.error({ err: preview.error, requestId }, "academia informes preview failed");
      return fail(reply, 500, "informe_fetch_failed", "Failed to fetch informe", requestId);
    }
    return ok(reply, preview, requestId);
  });

  // POST /api/v1/academia/informes/generar — genera (o regenera, con
  // forzar:true) el comentario con Claude y lo guarda, SIN enviar nada.
  app.post("/informes/generar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = GenerarInformeBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const apiKey = requireApiKey(reply, requestId);
    if (!apiKey) return;

    const admin = createSupabaseAdmin();

    // Política forward-only: solo hace falta comprobar el enviado_at previo
    // cuando `forzar` va a sobrescribir el comentario guardado — sin forzar,
    // generarYGuardarComentario reutiliza el existente y nunca toca un
    // informe ya enviado.
    if (parsed.data.forzar && !parsed.data.confirmar) {
      const { informe: existente, error: existenteErr } = await fetchInformeExistente(admin, auth.tenant.id, parsed.data.alumno_id, {
        mes: parsed.data.mes, anio: parsed.data.anio,
      });
      if (existenteErr) {
        req.log.error({ err: existenteErr, requestId }, "academia informes generar: fetch existente failed");
        return fail(reply, 500, "informe_fetch_failed", "Failed to fetch informe existente", requestId);
      }
      if (existente?.enviado_at) {
        return fail(reply, 409, "requiere_confirmacion", "Este informe ya se envió a la familia", requestId, {
          enviado_at: existente.enviado_at,
        });
      }
    }

    const resultado = await generarYGuardarComentario(admin, {
      tenantId: auth.tenant.id,
      alumnoId: parsed.data.alumno_id,
      mes: parsed.data.mes,
      anio: parsed.data.anio,
      apiKey,
      forzar: parsed.data.forzar,
    });
    if (!resultado.ok) {
      const [status, code] = CODES[resultado.code] || [500, "generar_informe_failed"];
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia informes generar failed");
      return fail(reply, status, code, resultado.motivo, requestId);
    }
    return ok(reply, { comentario: resultado.comentario, dias: resultado.dias }, requestId);
  });

  // POST /api/v1/academia/informes/regenerar — regenera el comentario (con
  // Claude) de TODOS los alumnos activos del período. Política
  // forward-only: si alguno ya está enviado y no se confirmó, no se toca
  // nada y se devuelve 409 con el conteo afectado.
  app.post("/informes/regenerar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = PeriodoInformesBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const apiKey = requireApiKey(reply, requestId);
    if (!apiKey) return;

    const admin = createSupabaseAdmin();
    const tenantId = auth.tenant.id;
    const { mes, anio, confirmar } = parsed.data;

    const { items, error: itemsErr } = await fetchFamiliasConAlumnos(admin, tenantId);
    if (itemsErr) {
      req.log.error({ err: itemsErr, requestId }, "academia informes regenerar: fetch familias failed");
      return fail(reply, 500, "informes_fetch_failed", "Failed to fetch familias", requestId);
    }
    const alumnoIds = items.flatMap(({ alumnosActivos }) => alumnosActivos.map((a) => a.id));

    const { porAlumno: informesEnviados, error: informesErr } = await fetchInformesEnviadosMes(admin, tenantId, alumnoIds, { mes, anio });
    if (informesErr) {
      req.log.error({ err: informesErr, requestId }, "academia informes regenerar: fetch informes failed");
      return fail(reply, 500, "informes_fetch_failed", "Failed to fetch informes", requestId);
    }

    const { requiereConfirmacion, afectados } = evaluarConfirmacionInformes(informesEnviados, alumnoIds, confirmar);
    if (requiereConfirmacion) {
      return fail(reply, 409, "requiere_confirmacion", "Hay informes ya enviados en este período", requestId, { afectados });
    }

    let regenerados = 0;
    const errores = [];
    for (const alumnoId of alumnoIds) {
      const resultado = await generarYGuardarComentario(admin, { tenantId, alumnoId, mes, anio, apiKey, forzar: true });
      if (resultado.ok) regenerados += 1;
      else errores.push({ alumnoId, motivo: resultado.motivo });
    }
    if (errores.length) req.log.error({ errores, requestId }, "academia informes regenerar: algunos fallaron");
    return ok(reply, { regenerados, fallidos: errores.length }, requestId);
  });

  // PUT /api/v1/academia/informes/comentario — sobrescribe el comentario a
  // mano (edición inline), sin llamar a Claude.
  app.put("/informes/comentario", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = EditarComentarioBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const resultado = await editarComentarioInforme(admin, {
      tenantId: auth.tenant.id,
      alumnoId: parsed.data.alumno_id,
      mes: parsed.data.mes,
      anio: parsed.data.anio,
      comentario: parsed.data.comentario,
    });
    if (!resultado.ok) {
      // resultado.error solo viene poblado cuando la consulta a Supabase
      // falló de verdad — el caso esperado ("no hay informe todavía", sin
      // error) no se loguea, para no llenar Sentry de ruido de uso normal.
      if (resultado.error) {
        req.log.error({ err: resultado.error, resultado, requestId }, "academia informes editar comentario failed");
      }
      return fail(reply, 404, "informe_not_found", resultado.motivo, requestId);
    }
    return ok(reply, { comentario: resultado.comentario }, requestId);
  });

  // POST /api/v1/academia/enviar-informe — genera (con IA, si falta) el
  // comentario mensual, el PDF del informe en tutordigital-pdf-service, y
  // lo envía por email (texto de acompañamiento + LOPD) a la familia del
  // alumno. Política forward-only: si ya se había enviado antes y no se
  // confirma, 409 requiere_confirmacion.
  app.post("/enviar-informe", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = EnviarInformeBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const apiKey = requireApiKey(reply, requestId);
    if (!apiKey) return;
    const pdfServiceUrl = getPdfServiceUrl();

    const admin = createSupabaseAdmin();
    const resultado = await enviarInformeDeAlumno(admin, {
      tenantId: auth.tenant.id,
      tenantNombre: auth.tenant.name,
      alumnoId: parsed.data.alumno_id,
      mes: parsed.data.mes,
      anio: parsed.data.anio,
      apiKey,
      pdfServiceUrl,
      confirmar: parsed.data.confirmar,
    });

    if (!resultado.ok) {
      if (resultado.code === "requiere_confirmacion") {
        return fail(reply, 409, "requiere_confirmacion", resultado.motivo, requestId, { enviado_at: resultado.enviado_at });
      }
      const [status, code] = CODES[resultado.code] || [500, "enviar_informe_failed"];
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia enviar-informe failed");
      return fail(reply, status, code, resultado.motivo, requestId);
    }
    return ok(reply, { enviado: true }, requestId);
  });
}
