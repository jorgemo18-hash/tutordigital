import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { INTENSIDADES } from "../../lib/generadorEjercicios/montadorDeHoja.js";
import { OBJETIVOS } from "../../lib/generadorEjercicios/catalogoDeBaterias.js";
import { catalogoDelPanel, hojaDelPanel, semillaNueva } from "../../lib/generadorEjercicios/hojaDelPanel.js";

// EL GENERADOR DE HOJAS DE EJERCICIOS, como un servicio más del panel de la
// academia (sección "Ejercicios"). Jorge, el 23/9: *"ponlo también en
// academias, que es un servicio más... lo usen o no"*.
//
// LO QUE HACE Y LO QUE NO, dicho claro porque es la primera versión:
//   - Monta la hoja en el servidor (el montador es código de servidor) y
//     devuelve el CONTENIDO; la plantilla la pinta el navegador, igual que
//     la vista previa.
//   - NO GUARDA NADA. La hoja no queda registrada en `contenido_hojas`, así
//     que el código del pie todavía no sirve para registrar fallos. Lo que
//     sí se devuelve es la `semilla`: con el mismo objetivo, intensidad y
//     semilla sale exactamente la misma hoja, que es lo que hará falta
//     guardar cuando exista el registro.
//   - El contenido de la hoja y su cabecera: ver hojaDelPanel.js.
export const ROLES = ["admin"];

export const GenerarSchema = z.object({
  objetivo: z.number().int().refine((n) => OBJETIVOS.includes(n), "objetivo desconocido"),
  intensidad: z.enum(Object.keys(INTENSIDADES)),
  // Texto corto: viaja de vuelta al navegador y, algún día, a la base de
  // datos. Si no llega, se inventa una.
  semilla: z.string().trim().min(1).max(40).optional(),
});

export default async function academiaHojasEjerciciosRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // Qué se puede pedir. Sale del catálogo, no de una lista escrita en el
  // navegador: cuando entre un objetivo nuevo, la pantalla lo ofrece sola.
  app.get("/catalogo", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ROLES });
    if (!auth.ok) return;
    return ok(reply, catalogoDelPanel(), requestId);
  });

  app.post("/generar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ROLES });
    if (!auth.ok) return;

    const parsed = GenerarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }
    const { objetivo, intensidad } = parsed.data;
    const semilla = parsed.data.semilla || semillaNueva();

    try {
      return ok(reply, { hoja: hojaDelPanel({ objetivo, intensidad, semilla }), semilla }, requestId);
    } catch (err) {
      req.log.error({ err, requestId, objetivo, intensidad, semilla }, "hoja de ejercicios: fallo al montar");
      return fail(reply, 500, "hoja_no_montada", "No se pudo montar la hoja", requestId);
    }
  });
}
