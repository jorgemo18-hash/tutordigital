import { lanzaNavegador } from "../server/lib/hojaPdf/lanzaNavegador.js";
import { crearNavegadorReutilizable } from "../server/lib/hojaPdf/navegadorReutilizable.js";
import { imprimeHojaEnPdf } from "../server/lib/hojaPdf/imprimeHojaEnPdf.js";
import { autorizaGenerador } from "../server/lib/hojaPdf/autorizaGenerador.js";

// POST /api/hoja-pdf — la hoja de ejercicios en PDF (función de Vercel).
// Por qué un PDF y por qué aquí: ver server/lib/hojaPdf/imprimeHojaEnPdf.js.
//
// Recibe el CONTENIDO de la hoja tal como está en el panel (con los cambios
// sueltos que haya hecho el profesor), no los datos para montarla: así el
// PDF es exactamente lo que se ve, sin volver a sortear nada.
const MAX_BYTES = 300 * 1024;
const API_BASE = process.env.API_BASE_URL || "https://tutordigital.onrender.com";

// Vive fuera del handler: sobrevive entre peticiones mientras la instancia
// siga caliente (ver navegadorReutilizable.js).
const navegadores = crearNavegadorReutilizable({ lanzar: () => lanzaNavegador() });

function error(res, status, mensaje) {
  res.status(status).json({ error: { message: mensaje } });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return error(res, 405, "Método no permitido.");

  // Preguntar a la API si puede (una ida y vuelta a Render) y arrancar
  // Chromium van A LA VEZ: antes era uno detrás de otro y el profesor
  // esperaba la suma de los dos.
  const acceso = autorizaGenerador({ cabeceras: req.headers, apiBase: API_BASE });
  const hoja = req.body?.hoja;
  const sinHoja = !hoja || typeof hoja !== "object" || !Array.isArray(hoja.actividades);
  const enorme = !sinHoja && Buffer.byteLength(JSON.stringify(hoja)) > MAX_BYTES;
  const navegadorListo = sinHoja || enorme ? null : navegadores.obtener();
  navegadorListo?.catch(() => {}); // si falla, se ve más abajo al esperarlo

  const permiso = await acceso;
  if (!permiso.ok) return error(res, permiso.status, "No tienes acceso al generador de hojas.");
  if (sinHoja) return error(res, 400, "Falta la hoja.");
  if (enorme) return error(res, 413, "La hoja es demasiado grande.");

  // La página de la hoja, de ESTE mismo despliegue: la versión de la
  // plantilla que imprime es la misma que tiene el panel.
  const origen = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.headers.host}`;
  try {
    const navegador = await navegadorListo;
    const { pdf } = await imprimeHojaEnPdf({
      navegador, urlPagina: `${origen}/assets/shared/hoja/hoja-imprimible.html`, hoja,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="hoja-de-ejercicios.pdf"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (err) {
    console.error("[hoja-pdf] no se pudo generar", err);
    // Por si el navegador quedó en mal estado: el siguiente arranca otro.
    await navegadores.descartar();
    return error(res, 500, "No se pudo generar el PDF. Prueba otra vez.");
  }
}
