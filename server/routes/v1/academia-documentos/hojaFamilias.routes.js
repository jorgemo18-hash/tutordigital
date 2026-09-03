import { makeRequestId } from "../../../lib/requestId.js";
import { fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { construirPayloadHojaFamilias } from "../../../lib/academiaHojaFamilias/payloadHojaFamilias.js";
import { buildHojaFamiliasPdfBuffer } from "../../../lib/academiaHojaFamilias/generarHojaFamilias.js";

const COLUMNAS =
  "franja_inicio, franja_fin, franja_inicio_2, franja_fin_2, franja_duracion, dias_laborables, " +
  "nombre_emisor, telefono_emisor, email_emisor, direccion_emisor, precios_publicos";

// GET /api/v1/academia/documentos/hoja-familias — la hoja de información
// para familias (horario y precios del centro) en A4 con cuatro cuartillas
// iguales, listo para imprimir y cortar.
//
// SIN CACHÉ, a diferencia de la hoja de inscripción. Aquí no hay
// microservicio ni LibreOffice: son cuatro rectángulos dibujados con pdfkit
// en el propio backend, del orden de milisegundos. Guardarlo en Storage
// costaría más (subida, hash, invalidación al tocar un precio) que
// generarlo cada vez, y añadiría la forma más tonta de fallar: entregar a
// una familia un papel con el horario del mes pasado.
export default async function academiaDocumentosHojaFamiliasRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/hoja-familias", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_config")
      .select(COLUMNAS)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (error) {
      req.log.error({ err: error, requestId }, "academia documentos hoja-familias: fallo leyendo config");
      return fail(reply, 500, "config_fetch_failed", "No se pudo leer la configuración del centro.", requestId);
    }

    // Un centro sin fila en academia_config no es un error: sale la hoja con
    // el horario por defecto y sin precios, que es exactamente lo que tiene
    // configurado.
    const datos = construirPayloadHojaFamilias({ tenantNombre: auth.tenant.name, config: data || {} });

    let buffer;
    try {
      buffer = await buildHojaFamiliasPdfBuffer(datos);
    } catch (err) {
      req.log.error({ err, requestId }, "academia documentos hoja-familias: fallo generando el PDF");
      return fail(reply, 500, "hoja_familias_failed", "No se pudo generar la hoja para familias.", requestId);
    }

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", 'inline; filename="Informacion_familias.pdf"');
    return reply.send(buffer);
  });
}
