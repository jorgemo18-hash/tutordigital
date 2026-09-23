import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { crearApiDeHojas } from "../../../shared/generador/apiDeHojas.js";

// LAS LLAMADAS DE RECURSOS en el panel del profesor. Las del generador de
// hojas son las compartidas con la academia (shared/generador/apiDeHojas.js)
// con el prefijo de Recursos, donde entran el profesor y el admin.
//
// `callJson`: como en el resto del panel, una sesión caducada lleva al login
// en vez de enseñarse como un error cualquiera.
export function crearCallJson({ apiFetchFn = apiFetch, clearSessionFn = clearSession, win = globalThis.window } = {}) {
  return async function callJson(ruta, opciones) {
    const res = await apiFetchFn(ruta, opciones);
    if (res.status === 401) {
      clearSessionFn();
      win.location.href = "/login";
      throw new Error("Sesión caducada.");
    }
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(cuerpo?.error?.message || "No se pudo completar la operación.");
    return cuerpo?.data || {};
  };
}

export const BASE_HOJAS = "/api/v1/recursos/hojas";

// Además del generador, las hojas GUARDADAS (paso 2, migración 129): se
// guarda la que se imprime, con su código, y se puede volver a abrir.
export function crearApiDeRecursos(deps) {
  const callJsonFn = crearCallJson(deps);
  const json = { "Content-Type": "application/json" };
  return {
    ...crearApiDeHojas({ base: BASE_HOJAS, callJsonFn }),
    guardar: ({ hoja, huecos, parametros }) => callJsonFn(`${BASE_HOJAS}/guardar`, {
      method: "POST", headers: json, body: JSON.stringify({ hoja, huecos, parametros }),
    }),
    recientes: () => callJsonFn(`${BASE_HOJAS}/recientes`),
    abrir: (id) => callJsonFn(`${BASE_HOJAS}/guardadas/${encodeURIComponent(id)}`),
  };
}
