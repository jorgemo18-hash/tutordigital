import { uploadFotoGasto } from "../../apiFinanzas.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";
import { buildFotoDisplay } from "./gastoFotoPreview.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// Foto de una factura en el drawer de detalle/edición de un gasto: si ya
// hay foto_url la muestra (imagen clicable, o enlace si es PDF); si no,
// muestra un botón "Subir factura" que sube el archivo directamente contra
// el gasto real (sin OCR, a diferencia de gastoUpload.js que se usa en
// modo creación) y vuelve a renderizar mostrando la foto ya subida.
export function buildGastoFotoBlock({ fotoUrl, gastoId, onFotoSubida, uploadFotoGastoFn = uploadFotoGasto }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  function render(url) {
    wrap.innerHTML = "";
    if (url) {
      wrap.appendChild(buildFotoDisplay(url));
      return;
    }

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
        const nuevaUrl = await uploadFotoGastoFn(gastoId, { base64, mime: file.type });
        onFotoSubida(nuevaUrl);
        render(nuevaUrl);
      } catch {
        setOcrStatus(status, "error");
      }
    });

    wrap.append(btn, input, status);
  }

  render(fotoUrl);
  return wrap;
}
