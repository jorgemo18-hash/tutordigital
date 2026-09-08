import { makeRequestId } from "../../../lib/requestId.js";
import { fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { construirPayloadHojaFamilias } from "../../../lib/academiaHojaFamilias/payloadHojaFamilias.js";
import { buildHojaFamiliasPdfBuffer } from "../../../lib/academiaHojaFamilias/generarHojaFamilias.js";
import { franjasQueOcupanPlaza } from "../../../lib/academiaHojaFamilias/ocupacionHoja.js";

// TIENE QUE PEDIR TODO LO QUE LEE construirPayloadHojaFamilias, y hay un
// test que lo comprueba comparando esta lista con el código del payload
// (hojaFamiliasColumnas.test.mjs).
//
// EL FALLO QUE LO MOTIVA (08/09/2026, lo vio Jorge en la hoja impresa).
// Faltaban `max_alumnos_por_franja` y `horario_reservas`. No dio ningún
// error: `estaCompleta(ocupacion, undefined)` compara contra 0 y devuelve
// false siempre, así que la rejilla salía impecable y COMPLETAMENTE VACÍA —
// sin una sola hora en rojo y sin la leyenda que las explica, porque la
// leyenda solo se imprime si hay alguna marcada. La hoja que se reparte a
// las familias decía que había sitio a todas horas.
//
// Un campo que falta en un select se convierte en `undefined`, y `undefined`
// se lee como "no hay tope" o "no hay reservas", que son estados legítimos.
// Por eso esto no puede vigilarse leyendo el PDF: hay que comprobar la
// lista.
const COLUMNAS =
  "franja_inicio, franja_fin, franja_inicio_2, franja_fin_2, franja_duracion, dias_laborables, " +
  "max_alumnos_por_franja, horario_reservas, " +
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
    // Las franjas vigentes del centro deciden qué horas salen marcadas como
    // completas. Un fallo leyéndolas NO impide la hoja: sale sin marcas, que
    // es mejor que no poder imprimir nada cuando hay una familia esperando.
    // DOS FILTROS, y los dos hacen falta — exactamente los mismos que el
    // cuadrante de pantalla (ver academia.horario.routes.js):
    //   - `fecha_fin is null`: la franja sigue vigente;
    //   - alumno activo: un BORRADOR conserva su horario con fecha_fin a
    //     null (es un alta a medias, y tener su hueco reservado es lo
    //     correcto), pero todavía no ocupa plaza.
    // Sin el segundo, la hoja contaba a los borradores y marcaba como
    // completas horas en las que sí queda sitio. El papel y la pantalla
    // tienen que decir lo mismo del mismo martes.
    const { data: filasHorario, error: errorHorario } = await admin
      .from("academia_horario")
      .select("dia_semana, hora_inicio, hora_fin, alumno:academia_alumnos(activo)")
      .eq("tenant_id", auth.tenant.id)
      .is("fecha_fin", null);

    const franjas = franjasQueOcupanPlaza(filasHorario);

    if (errorHorario) {
      req.log.warn({ err: errorHorario, requestId }, "academia documentos hoja-familias: sin horario, se imprime sin marcar completas");
    }

    const datos = construirPayloadHojaFamilias({
      tenantNombre: auth.tenant.name,
      config: data || {},
      franjas,
    });

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
