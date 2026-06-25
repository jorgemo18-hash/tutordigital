import { extraerInscripcion } from "../api.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function setStatus(el, mode) {
  el.innerHTML = "";
  if (mode === "hidden") {
    el.className = "hidden";
    return;
  }
  if (mode === "loading") {
    el.className = "ac-banner amber";
    const spinner = document.createElement("span");
    spinner.className = "ac-spinner";
    el.append(spinner, document.createTextNode(" Extrayendo datos…"));
    return;
  }
  if (mode === "success") {
    el.className = "ac-banner green";
    el.textContent = "✓ Datos extraídos — revisa y completa antes de guardar";
    return;
  }
  el.className = "ac-banner red";
  el.textContent = "No se pudieron extraer los datos — rellena manualmente";
}

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
  input.accept = "image/*";
  input.capture = "environment";
  input.className = "ac-upload-input";

  const status = document.createElement("div");
  setStatus(status, "hidden");

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!MEDIA_TYPES.includes(file.type)) {
      setStatus(status, "error");
      return;
    }
    setStatus(status, "loading");
    try {
      const base64 = await readFileAsBase64(file);
      const datos = await extraerInscripcionFn({ base64, mediaType: file.type });
      setStatus(status, "success");
      onExtraido(datos);
    } catch {
      setStatus(status, "error");
    }
  });

  wrap.append(btn, input, status);
  return wrap;
}
