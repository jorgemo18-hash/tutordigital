import { extraerInscripcion } from "../api.js";
import { readFileAsBase64 } from "../fileUtils.js";
import { setOcrStatus } from "../ocrStatusBanner.js";
import { buildFileTooLargeHelp } from "../upload/tooLargeHelp.js";
import { buildFotoDisplay } from "../upload/fotoDisplay.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// Botón "Subir ficha de inscripción" — captura/selecciona la foto de la
// hoja en papel, la envía a OCR y entrega el JSON extraído vía `onExtraido`.
// El llamador decide cómo aplicar esos datos a los campos del drawer.
//
// LA FOTO SE QUEDA. Antes se usaba para leer los datos y se tiraba: la
// academia se quedaba con el alumno dado de alta pero SIN el documento
// original, que es justo lo que hay que poder enseñar si una familia
// discute lo que firmó. Ahora el archivo se guarda en memoria, se muestra
// la vista previa (clic = tamaño completo) y `getArchivo()` lo entrega al
// drawer, que lo sube DESPUÉS de crear al alumno, contra su id real —
// mismo camino que la factura de un gasto (ver gastoUpload.js), y sin
// archivos huérfanos en Storage si el admin cierra sin guardar.
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

  const preview = document.createElement("div");
  preview.className = "hidden";

  // La ficha elegida, lista para subirla cuando el alumno exista. Se guarda
  // aunque el OCR falle: la foto de la hoja firmada vale por sí sola, y
  // perderla porque el reconocimiento de texto no acertó sería tirar lo
  // importante por lo accesorio.
  let archivo = null;

  function limpiarAyuda() {
    help.innerHTML = "";
    help.className = "hidden";
  }

  // Vista previa a partir del propio File en memoria — no depende de que la
  // subida haya ocurrido (aún no ha ocurrido: el alumno todavía no existe).
  //
  // Falla en silencio a propósito: es decorativa y va ANTES de entregar los
  // datos del OCR. Si createObjectURL reventara (pasa en entornos donde File
  // no es un Blob nativo), sin este try se perdería lo único que importa
  // —los datos extraídos y el archivo a adjuntar— por no pintar una
  // miniatura.
  function mostrarPreview(file) {
    try {
      preview.innerHTML = "";
      preview.className = "";
      preview.appendChild(buildFotoDisplay(URL.createObjectURL(file), { esPdf: false, alt: "Ficha de inscripción" }));
    } catch {
      preview.className = "hidden";
    }
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
      archivo = { base64, mime: file.type };
      const datos = await extraerInscripcionFn({ base64, mediaType: file.type });
      mostrarPreview(file);
      setOcrStatus(status, "success");
      onExtraido(datos);
    } catch (err) {
      if (err?.code === "file_too_large") {
        // El archivo se descarta: el flujo de conversión volverá a llamar a
        // procesarArchivo con la versión reducida, y esa es la que hay que
        // adjuntar. Guardar la grande la haría fallar también al subirla.
        archivo = null;
        setOcrStatus(status, "hidden");
        help.className = "";
        help.appendChild(buildFileTooLargeHelp(file, { onConvertido: procesarArchivo }));
        return;
      }
      // El resto (conversion_failed de un DNG que el servidor no sabe abrir,
      // ocr_failed de verdad, red caída...) se enseña con SU mensaje. El
      // servidor ya manda uno explicativo; tragárselo era el problema. La
      // foto sigue valiendo y se adjuntará igual al guardar.
      mostrarPreview(file);
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

  wrap.append(btn, input, status, help, preview);
  return { wrap, getArchivo: () => archivo };
}
