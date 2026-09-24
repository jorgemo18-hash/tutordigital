import { lanzaNavegador } from "../server/lib/hojaPdf/lanzaNavegador.js";
import { crearNavegadorReutilizable } from "../server/lib/hojaPdf/navegadorReutilizable.js";
import { autorizaGenerador } from "../server/lib/hojaPdf/autorizaGenerador.js";
import { imprimeProgramacionEnPdf, lineasDeLaProgramacion } from "../server/lib/programacionPdf/imprimeProgramacionEnPdf.js";

// POST /api/programacion-pdf — la programación didáctica en PDF (función de
// Vercel, como /api/hoja-pdf). Recibe lo mismo que pinta el paso
// "Documento" del editor: el currículo de la materia, los datos de la
// programación, la cabecera y el centro. Así el PDF es lo que se ve.
//
// Quién puede: el mismo que puede usar Recursos (se pregunta a la API, ver
// autorizaGenerador.js). La programación no se lee de la base aquí: la
// manda el editor, que ya la tiene abierta y guardada.
const MAX_BYTES = 900 * 1024; // el currículo de una materia con todos sus saberes cabe de sobra
const API_BASE = process.env.API_BASE_URL || "https://tutordigital.onrender.com";

const navegadores = crearNavegadorReutilizable({ lanzar: () => lanzaNavegador() });

function error(res, status, mensaje) {
  res.status(status).json({ error: { message: mensaje } });
}

export function validaContenido(cuerpo) {
  const c = cuerpo?.contenido;
  if (!c || typeof c !== "object") return "Falta la programación.";
  if (!c.curriculo || typeof c.curriculo !== "object" || !Array.isArray(c.curriculo.competencias)) return "Falta el currículo.";
  if (!c.datos || typeof c.datos !== "object") return "Faltan los datos de la programación.";
  if (!c.cabecera || typeof c.cabecera !== "object") return "Falta la cabecera.";
  if (Buffer.byteLength(JSON.stringify(c)) > MAX_BYTES) return "La programación es demasiado grande.";
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return error(res, 405, "Método no permitido.");

  const acceso = autorizaGenerador({ cabeceras: req.headers, apiBase: API_BASE });
  const problema = validaContenido(req.body);
  const navegadorListo = problema ? null : navegadores.obtener();
  navegadorListo?.catch(() => {});

  const permiso = await acceso;
  if (!permiso.ok) return error(res, permiso.status, "No tienes acceso a Recursos.");
  if (problema) return error(res, problema.includes("grande") ? 413 : 400, problema);

  const contenido = req.body.contenido;
  const origen = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.headers.host}`;
  try {
    const navegador = await navegadorListo;
    const { pdf } = await imprimeProgramacionEnPdf({
      navegador,
      urlPagina: `${origen}/assets/shared/programacion/programacion-imprimible.html`,
      contenido,
      lineas: lineasDeLaProgramacion(contenido),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="programacion-didactica.pdf"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (err) {
    console.error("[programacion-pdf] no se pudo generar", err);
    await navegadores.descartar();
    return error(res, 500, "No se pudo generar el PDF. Prueba otra vez.");
  }
}
