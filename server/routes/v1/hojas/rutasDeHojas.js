import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { INTENSIDADES } from "../../../lib/generadorEjercicios/montadorDeHoja.js";
import { OBJETIVOS } from "../../../lib/generadorEjercicios/catalogoDeBaterias.js";
import { temaPorId } from "../../../lib/generadorEjercicios/temasConGenerador.js";
import {
  catalogoDelPanel, hojaDelPanel, actividadDelPanel, semillaNueva,
} from "../../../lib/generadorEjercicios/hojaDelPanel.js";
import { MAX_ACTIVIDADES } from "../../../../assets/shared/hoja/js/actividades.js";

// LAS RUTAS DEL GENERADOR DE HOJAS, para cualquier panel que lo use.
//
// Las usan dos paneles con reglas de acceso distintas: la sección
// "Ejercicios" de la academia (solo admin, /api/v1/academia/hojas-ejercicios)
// y Recursos del profesor de instituto (profesor y admin,
// /api/v1/recursos/hojas). Las rutas son las mismas; cambia quién puede
// entrar, y eso es lo único que recibe la fábrica. Escribirlas dos veces
// sería tener dos generadores que se separan en silencio.
//
// LO QUE HACE Y LO QUE NO, dicho claro porque es la primera versión:
//   - Monta la hoja en el servidor (el montador es código de servidor) y
//     devuelve el CONTENIDO; la plantilla la pinta el navegador.
//   - NO GUARDA NADA. La hoja no queda registrada en `contenido_hojas`, así
//     que el pie sale sin código. Lo que sí se devuelve es la `semilla`: con
//     los mismos datos y la misma semilla sale la misma hoja.
//   - El contenido y los cambios sueltos: ver hojaDelPanel.js.
export const Base = {
  temaId: z.string().refine((id) => Boolean(temaPorId(id)), "tema sin generador"),
  objetivo: z.number().int().refine((n) => OBJETIVOS.includes(n), "objetivo desconocido"),
  intensidad: z.enum(Object.keys(INTENSIDADES)),
  // Texto corto: viaja de vuelta al navegador y, algún día, a la base de
  // datos. Si no llega, se inventa una.
  semilla: z.string().trim().min(1).max(40).optional(),
};

export const GenerarSchema = z.object({
  ...Base,
  // "Todo el tema": uno de cada objetivo (ver hojaDelTema.js). `objetivo`
  // sigue llegando (el panel siempre tiene uno), pero no cuenta.
  todoElTema: z.boolean().optional(),
  // Cuántas actividades. Sin él, las que quepan en los folios de la
  // intensidad. Por encima del máximo del objetivo no es un error: el
  // montador da las que hay (ver maxActividades).
  actividades: z.number().int().min(1).max(MAX_ACTIVIDADES).optional(),
  // Tipos concretos, pedidos en palabras (ver interpretePedido.js). Si
  // vienen, mandan sobre `actividades`.
  baterias: z.array(z.string().trim().min(1).max(60)).min(1).max(MAX_ACTIVIDADES).optional(),
});

export const ActividadSchema = z.object({
  ...Base,
  clave: z.string().trim().min(1).max(60),
});

async function autoriza(req, reply, roles) {
  const requestId = req.requestId || makeRequestId();
  const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles });
  return { requestId, ok: auth.ok };
}

function invalido(reply, parsed, requestId) {
  return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
}

export function crearRutasDeHojas({ roles }) {
  return async function rutasDeHojas(app) {
  const guard = makeTenantMembershipGuard();

  // Qué se puede pedir. Sale del catálogo, no de una lista escrita en el
  // navegador: cuando entre un tema nuevo, la pantalla lo ofrece sola.
  app.get("/catalogo", { preHandler: guard.preHandler }, async (req, reply) => {
    const { requestId, ok: autorizado } = await autoriza(req, reply, roles);
    if (!autorizado) return;
    return ok(reply, catalogoDelPanel(), requestId);
  });

  app.post("/generar", { preHandler: guard.preHandler }, async (req, reply) => {
    const { requestId, ok: autorizado } = await autoriza(req, reply, roles);
    if (!autorizado) return;
    const parsed = GenerarSchema.safeParse(req.body || {});
    if (!parsed.success) return invalido(reply, parsed, requestId);
    const semilla = parsed.data.semilla || semillaNueva();
    try {
      return ok(reply, { ...hojaDelPanel({ ...parsed.data, semilla }), semilla }, requestId);
    } catch (err) {
      req.log.error({ err, requestId, ...parsed.data, semilla }, "hoja de ejercicios: fallo al montar");
      return fail(reply, 500, "hoja_no_montada", "No se pudo montar la hoja", requestId);
    }
  });

  // Un ejercicio suelto, para cambiar uno de la hoja sin rehacerla.
  app.post("/actividad", { preHandler: guard.preHandler }, async (req, reply) => {
    const { requestId, ok: autorizado } = await autoriza(req, reply, roles);
    if (!autorizado) return;
    const parsed = ActividadSchema.safeParse(req.body || {});
    if (!parsed.success) return invalido(reply, parsed, requestId);
    const semilla = parsed.data.semilla || semillaNueva();
    try {
      const resultado = actividadDelPanel({ ...parsed.data, semilla });
      if (!resultado) {
        return fail(reply, 400, "bateria_no_disponible", "Ese ejercicio no es de este objetivo", requestId);
      }
      return ok(reply, { ...resultado, semilla }, requestId);
    } catch (err) {
      req.log.error({ err, requestId, ...parsed.data, semilla }, "hoja de ejercicios: fallo al generar un ejercicio");
      return fail(reply, 500, "actividad_no_generada", "No se pudo generar el ejercicio", requestId);
    }
  });
}
}
