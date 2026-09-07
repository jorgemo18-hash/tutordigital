import { uploadFichaAlumno, descargarFichaAlumno } from "../../api.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";
import { crearVisorAdjunto } from "../../upload/archivoAdjunto.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// La ficha de inscripción en papel de un alumno YA existente: si la tiene la
// enseña (clic = tamaño completo); si no, un botón para subirla, que la sube
// directamente contra el alumno real y sin pasar por el OCR — los datos ya
// están escritos, lo que falta es el documento.
//
// YA NO SE PINTA UNA URL. La ficha vive en un bucket privado (migración 114)
// y hay que descargarla por una ruta que exige sesión, así que el pintado es
// ASÍNCRONO: primero se devuelve el bloque, y el archivo aparece cuando llega.
// Antes bastaba con un <img src=ficha_url> porque esa URL abría la hoja
// firmada de un menor a cualquiera que la tuviera.
//
// `fichaUrlLegado` es esa URL vieja, para las fichas que aún no ha movido
// scripts/migrar-archivos-privados.mjs.
//
// Mismo papel que gastoFotoBlock.js para la factura de un gasto. Se
// mantiene aparte y no se comparte el módulo entero porque cambian el
// endpoint, el texto y el alt; lo que sí se comparte es el visor
// (upload/archivoAdjunto.js), que es donde estaba la lógica de verdad.
export function buildFichaBlock({
  fichaUrlLegado = null,
  tieneFicha = false,
  alumnoId,
  onFichaSubida = () => {},
  uploadFichaAlumnoFn = uploadFichaAlumno,
  descargarFichaFn = descargarFichaAlumno,
  readFileAsBase64Fn = readFileAsBase64,
}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  const visor = crearVisorAdjunto({
    descargarFn: () => descargarFichaFn(alumnoId),
    urlLegado: fichaUrlLegado,
    alt: "Ficha de inscripción",
  });

  async function mostrarFicha() {
    wrap.innerHTML = "";
    const el = await visor.cargar().catch(() => null);
    if (el) wrap.appendChild(el);
    else renderSubida();
  }

  function renderSubida() {
    wrap.innerHTML = "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-drawer-upload-btn ac-drawer-upload-btn--active";
    btn.textContent = "📎 Subir ficha de inscripción";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif,image/x-adobe-dng,image/dng,.dng";
    input.className = "ac-upload-input";

    const status = document.createElement("div");
    setOcrStatus(status, "hidden");

    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      if (!MEDIA_TYPES.includes(file.type)) {
        setOcrStatus(status, "error", { errorText: "Solo se aceptan imágenes JPG/PNG o PDF." });
        return;
      }
      setOcrStatus(status, "loading");
      try {
        const base64 = await readFileAsBase64Fn(file);
        const rutaNueva = await uploadFichaAlumnoFn(alumnoId, { base64, mime: file.type });
        onFichaSubida(rutaNueva);
        await mostrarFicha();
      } catch (err) {
        // Con su mensaje: el servidor distingue tamaño, conversión y fallo
        // real, y aplanarlos fue justo lo que llevó a un diagnóstico
        // equivocado en el OCR de la ficha.
        setOcrStatus(status, "error", { errorText: err?.message || undefined });
      }
    });

    wrap.append(btn, input, status);
  }

  if (tieneFicha || fichaUrlLegado) mostrarFicha();
  else renderSubida();
  return wrap;
}
