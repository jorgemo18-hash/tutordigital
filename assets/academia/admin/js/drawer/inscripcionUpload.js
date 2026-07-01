import { extraerInscripcion } from "../api.js";
import { readFileAsBase64 } from "../fileUtils.js";
import { setOcrStatus } from "../ocrStatusBanner.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// Botón "Subir ficha de inscripción" — captura/selecciona una imagen, la
// envía a OCR y entrega el JSON extraído vía `onExtraido`. El llamador
// decide cómo aplicar esos datos a los campos del drawer.
export function buildInscripcionUpload({ onExtraido, extraerInscripcionFn = extraerInscripcion } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-drawer-upload-btn ac-drawer-upload-btn--active";
  btn.textContent = "📷 Subir ficha de inscripción";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,.dng";
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
      setOcrStatus(status, "error");
      return;
    }
    setOcrStatus(status, "loading");
    try {
      const base64 = await readFileAsBase64(file);
      const datos = await extraerInscripcionFn({ base64, mediaType: file.type });
      setOcrStatus(status, "success");
      onExtraido(datos);
    } catch {
      setOcrStatus(status, "error");
    }
  });

  wrap.append(btn, input, status);
  return wrap;
}
