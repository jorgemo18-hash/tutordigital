import { apiFetch } from "../js/auth.js";

// LAS LLAMADAS DEL GENERADOR DE HOJAS, para cualquier panel que lo use.
//
// Las rutas son las mismas en la academia y en Recursos del profesor; solo
// cambia el prefijo (y con él quién entra, ver server/routes/v1/hojas/).
// `callJsonFn` es la de cada panel: cada uno decide qué hacer con una sesión
// caducada (llevar a su login) y cómo leer el error.
export function crearApiDeHojas({ base, callJsonFn }) {
  const post = (ruta, cuerpo) => callJsonFn(`${base}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

  return {
    catalogo: () => callJsonFn(`${base}/catalogo`),

    // `semilla` opcional: sin ella el servidor inventa una y la devuelve, y
    // con la misma semilla sale exactamente la misma hoja. `actividades`
    // opcional: sin ella, "automático" (las que quepan en la intensidad).
    generar({ temaId, objetivo, intensidad, semilla, actividades, baterias }) {
      const cuerpo = { temaId, objetivo, intensidad };
      if (semilla) cuerpo.semilla = semilla;
      if (baterias?.length) cuerpo.baterias = baterias;
      else if (actividades) cuerpo.actividades = actividades;
      return post("/generar", cuerpo);
    },

    // Un ejercicio suelto (una batería concreta) para cambiar uno de la hoja
    // sin rehacer los demás. Sin `semilla`, otros números cada vez.
    actividad: ({ temaId, objetivo, intensidad, clave }) => post("/actividad", { temaId, objetivo, intensidad, clave }),

    // El pedido en palabras: la conversación y lo que hay en pantalla.
    // Devuelve hoja (con `plan`), ejercicio (con `clave`), pregunta, o
    // fuera_de_catalogo. Ver server/lib/generadorEjercicios/interpretePedido.js.
    interpretar: ({ conversacion, contexto }) => post("/interpretar", { conversacion, contexto }),
  };
}

// La hoja en PDF (función de Vercel /api/hoja-pdf, en el MISMO dominio que el
// panel, no en la API de Render: ver api/hoja-pdf.js). Se manda el contenido
// tal como está en pantalla, con los cambios sueltos que se hayan hecho.
// Devuelve el PDF como Blob.
export async function pedirPdfDeLaHoja(hoja, { apiFetchFn = apiFetch, origen = globalThis.location?.origin } = {}) {
  const res = await apiFetchFn(`${origen}/api/hoja-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hoja }),
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new Error(cuerpo?.error?.message || "No se pudo generar el PDF.");
  }
  return res.blob();
}
