import { extraerGasto } from "../../apiFinanzas.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// Botón "Subir factura" — captura/selecciona una foto o PDF de una
// factura/ticket de gasto, la envía a OCR y entrega el JSON extraído vía
// `onExtraido`. El llamador decide cómo aplicar esos datos a los campos
// del drawer — mismo patrón que inscripcionUpload.js (drawer de alumno).
export function buildGastoUpload({ onExtraido, extraerGastoFn = extraerGasto } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-drawer-upload-btn ac-drawer-upload-btn--active";
  btn.textContent = "📎 Subir factura";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,application/pdf";
  input.capture = "environment";
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
      const datos = await extraerGastoFn({ base64, mediaType: file.type });
      setOcrStatus(status, "success");
      onExtraido(datos);
    } catch {
      setOcrStatus(status, "error");
    }
  });

  wrap.append(btn, input, status);
  return wrap;
}
