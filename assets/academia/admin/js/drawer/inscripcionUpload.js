import { extraerInscripcion } from "../api.js";
import { readFileAsBase64 } from "../fileUtils.js";
import { setOcrStatus } from "../ocrStatusBanner.js";
import { buildFileTooLargeHelp } from "../upload/tooLargeHelp.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// Botón "Subir ficha de inscripción" — captura/selecciona una imagen, la
// envía a OCR y entrega el JSON extraído vía `onExtraido`. El llamador
// decide cómo aplicar esos datos a los campos del drawer.
//
// ANTES TODOS LOS ERRORES SE VEÍAN IGUAL. El catch era `catch {}` sin la
// variable, así que un archivo de más de 5MB, un DNG que el servidor no
// puede convertir y un fallo real del OCR mostraban los tres el mismo
// "No se pudieron extraer los datos — rellena manualmente".
//
// Eso deja al admin sin saber qué hacer, y con un diagnóstico equivocado:
// parecía "el OCR no lee este formato" cuando en realidad era el tamaño.
// Una foto JPG de móvil pesa 2-4MB y pasa; un PNG de la misma hoja se va a
// 8-10MB y un DNG a 25MB, y los rechaza el límite ANTES de mirar el
// formato. El servidor siempre distinguió los tres casos (file_too_large /
// conversion_failed / ocr_failed) — era esta pantalla la que los aplanaba.
//
// La ayuda para convertir (buildFileTooLargeHelp) ya existía, pero solo
// estaba enganchada en el flujo de gastos. Aquí no, y por eso "la opción de
// convertir" no aparecía nunca al subir una ficha.
export function buildInscripcionUpload({
  onExtraido,
  extraerInscripcionFn = extraerInscripcion,
  // Inyectable, igual que en el flujo de gastos: FileReader no se comporta
  // igual fuera del navegador y sin esto no hay forma de probar el flujo.
  readFileAsBase64Fn = readFileAsBase64,
} = {}) {
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

  const help = document.createElement("div");
  help.className = "hidden";

  function limpiarAyuda() {
    help.innerHTML = "";
    help.className = "hidden";
  }

  async function procesarArchivo(file) {
    limpiarAyuda();
    if (!MEDIA_TYPES.includes(file.type)) {
      setOcrStatus(status, "error", { errorText: "Solo se aceptan imágenes JPG, PNG, WEBP, HEIC o DNG." });
      return;
    }
    setOcrStatus(status, "loading");
    try {
      const base64 = await readFileAsBase64Fn(file);
      const datos = await extraerInscripcionFn({ base64, mediaType: file.type });
      setOcrStatus(status, "success");
      onExtraido(datos);
    } catch (err) {
      if (err?.code === "file_too_large") {
        // Mismo camino que en gastos: se ofrece convertir y, al hacerlo, se
        // reintenta solo con el archivo ya reducido.
        setOcrStatus(status, "hidden");
        help.className = "";
        help.appendChild(buildFileTooLargeHelp(file, { onConvertido: procesarArchivo }));
        return;
      }
      // El resto (conversion_failed de un DNG que el servidor no sabe abrir,
      // ocr_failed de verdad, red caída...) se enseña con SU mensaje. El
      // servidor ya manda uno explicativo; tragárselo era el problema.
      setOcrStatus(status, "error", { errorText: err?.message || undefined });
    }
  }

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    await procesarArchivo(file);
  });

  wrap.append(btn, input, status, help);
  return wrap;
}
