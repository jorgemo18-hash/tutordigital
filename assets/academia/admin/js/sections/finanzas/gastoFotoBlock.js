import { uploadFotoGasto, descargarFotoGasto } from "../../apiFinanzas.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";
import { crearVisorAdjunto } from "../../upload/archivoAdjunto.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// Foto de una factura en el drawer de detalle/edición de un gasto: si la hay
// la muestra (imagen clicable, o iframe si es PDF); si no, un botón "Subir
// factura" que sube el archivo directamente contra el gasto real (sin OCR, a
// diferencia de gastoUpload.js que se usa en modo creación).
//
// La factura vive en un bucket PRIVADO desde la migración 114 y hay que
// descargarla por una ruta con sesión, así que el pintado es asíncrono.
// `fotoUrlLegado` es la URL pública antigua, para las facturas que aún no ha
// movido scripts/migrar-archivos-privados.mjs.
export function buildGastoFotoBlock({
  fotoUrlLegado = null,
  tieneFoto = false,
  gastoId,
  onFotoSubida,
  uploadFotoGastoFn = uploadFotoGasto,
  descargarFotoFn = descargarFotoGasto,
}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  const visor = crearVisorAdjunto({
    descargarFn: () => descargarFotoFn(gastoId),
    urlLegado: fotoUrlLegado,
    alt: "Factura",
  });

  async function mostrarFoto() {
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
    btn.textContent = "📎 Subir factura";

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
        const base64 = await readFileAsBase64(file);
        const rutaNueva = await uploadFotoGastoFn(gastoId, { base64, mime: file.type });
        onFotoSubida(rutaNueva);
        await mostrarFoto();
      } catch {
        setOcrStatus(status, "error");
      }
    });

    wrap.append(btn, input, status);
  }

  if (tieneFoto || fotoUrlLegado) mostrarFoto();
  else renderSubida();
  return wrap;
}
