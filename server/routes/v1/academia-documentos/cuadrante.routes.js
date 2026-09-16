import { makeRequestId } from "../../../lib/requestId.js";
import { fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchFranjasVisibles, findProfesorId } from "../academia.horario.routes.js";
import {
  COLUMNAS_CONFIG,
  construirPayloadCuadrante,
  tituloDelCuadrante,
} from "../../../lib/academiaCuadrante/payloadCuadrante.js";
import { buildCuadrantePdfBuffer } from "../../../lib/academiaCuadrante/generarCuadrante.js";

// GET /api/v1/academia/documentos/cuadrante — el cuadrante semanal en PDF,
// A4 horizontal, listo para colgar en la pared.
//
// SE REUSA `fetchFranjasVisibles` DE LA RUTA DEL HORARIO, y no es por ahorrar
// líneas: ahí vive la regla de seguridad de qué franjas puede ver cada uno
// (un profesor, solo las de sus alumnos asignados; nunca el centro entero si
// no tiene ninguna). Una segunda consulta aquí sería una segunda oportunidad
// de equivocarse con datos de menores, y además el papel enseñaría un
// cuadrante distinto del de la pantalla.
//
// SIN CACHÉ, igual que la hoja de familias: son rectángulos con pdfkit en el
// propio backend, milisegundos. Guardarlo costaría más que generarlo y
// añadiría la forma más tonta de fallar — entregar el horario del mes pasado.
export default async function academiaDocumentosCuadranteRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/cuadrante", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    // Mismos parámetros que la pantalla: `ambito=profesor` para que un admin
    // pida SU cuadrante en vez del centro entero, y `sin_nombres` para el modo
    // de enseñárselo a una familia. Solo pueden reducir lo que se ve.
    const ambitoProfesor = String(req.query?.ambito || "") === "profesor";
    const sinNombres = String(req.query?.sin_nombres || "") === "1";

    const { franjas, error } = await fetchFranjasVisibles(admin, {
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      role: auth.membership.role,
      findProfesorIdFn: findProfesorId,
      ambitoProfesor,
    });

    if (error) {
      req.log.error({ err: error, requestId }, "academia documentos cuadrante: fallo leyendo el horario");
      return fail(reply, 500, "horario_fetch_failed", "No se pudo leer el horario.", requestId);
    }

    const { data: config, error: errorConfig } = await admin
      .from("academia_config")
      .select(COLUMNAS_CONFIG)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    // Un centro sin fila en academia_config no es un error: sale el cuadrante
    // con el horario por defecto, que es exactamente lo que tiene configurado.
    if (errorConfig) {
      req.log.error({ err: errorConfig, requestId }, "academia documentos cuadrante: fallo leyendo config");
      return fail(reply, 500, "config_fetch_failed", "No se pudo leer la configuración del centro.", requestId);
    }

    const datos = construirPayloadCuadrante({
      franjas,
      config: config || {},
      centro: auth.tenant.name || "",
      titulo: tituloDelCuadrante({ ambitoProfesor, role: auth.membership.role }),
      sinNombres,
    });

    let buffer;
    try {
      buffer = await buildCuadrantePdfBuffer(datos);
    } catch (err) {
      req.log.error({ err, requestId }, "academia documentos cuadrante: fallo generando el PDF");
      return fail(reply, 500, "cuadrante_failed", "No se pudo generar el cuadrante.", requestId);
    }

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", 'inline; filename="Cuadrante_semanal.pdf"');
    return reply.send(buffer);
  });
}
