import { extraerGasto } from "../../apiFinanzas.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";
import { buildGastoUploadButtons } from "./gastoUpload/buttons.js";
import { buildFileTooLargeHelp } from "./gastoUpload/tooLargeHelp.js";
import { buildFotoDisplay } from "./gastoFotoPreview.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// Botones "Hacer foto" / "Subir archivo" — capturan/seleccionan una foto o
// PDF de una factura/ticket de gasto, la envían a OCR y entregan el JSON
// extraído vía `onExtraido`. Si el OCR rechaza el archivo por tamaño, se
// muestra ayuda para convertirlo en vez del error genérico — mismo patrón
// que inscripcionUpload.js (drawer de alumno) para el resto de errores.
//
// AQUÍ NO SE SUBE NADA. Antes se subía el archivo al instante con un id
// inventado (crypto.randomUUID()) "para tener ya la URL lista", y luego esa
// URL se perdía: rellenarDesdeOcr/leerValores no la miraban, así que nunca
// llegaba al POST de creación. Resultado: el gasto quedaba sin foto y el
// archivo huérfano en Storage, bajo un id que no corresponde a ningún gasto
// (el endpoint hace UPDATE ... WHERE id = <inventado>, que no afecta a
// ninguna fila y no da error, así que ni siquiera se notaba).
//
// Ahora el archivo se guarda en memoria y `getArchivo()` lo entrega al
// drawer, que lo sube DESPUÉS de crear el gasto, contra su id real y por el
// mismo endpoint que ya usa la edición. Un camino en vez de dos, y sin
// huérfanos: si el admin cierra el drawer sin guardar, no se ha subido nada.
export function buildGastoUpload({
  onExtraido,
  extraerGastoFn = extraerGasto,
  // Inyectable como el resto de dependencias: FileReader no funciona igual
  // fuera del navegador y sin esto no hay forma de probar el flujo.
  readFileAsBase64Fn = readFileAsBase64,
} = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  const status = document.createElement("div");
  setOcrStatus(status, "hidden");

  const help = document.createElement("div");
  help.className = "hidden";

  const preview = document.createElement("div");
  preview.className = "hidden";

  // El archivo elegido, listo para subirlo cuando el gasto exista. Se
  // guarda aunque el OCR falle: la foto de la factura vale por sí sola
  // (justificante del gasto) y perderla porque el reconocimiento de texto
  // no acertó sería tirar lo importante por lo accesorio.
  let archivo = null;

  function limpiarAyuda() {
    help.innerHTML = "";
    help.className = "hidden";
  }

  // Vista previa a partir del propio File en memoria — no depende de que la
  // subida a Storage (uploadFotoGastoFn) haya terminado ni tenga éxito, así
  // que aparece igual de rápido tanto si esa subida falla como si tarda.
  //
  // Falla en silencio a propósito: la vista previa es decorativa y va ANTES
  // de entregar los datos del OCR. Si createObjectURL reventara (pasa en
  // entornos donde File no es un Blob nativo, y podría pasar con memoria muy
  // justa), sin este try se perdería lo único que importa —los datos
  // extraídos y el archivo a adjuntar— por no poder pintar una miniatura.
  function mostrarPreview(file) {
    try {
      preview.innerHTML = "";
      preview.className = "";
      preview.appendChild(buildFotoDisplay(URL.createObjectURL(file), { esPdf: file.type === "application/pdf" }));
    } catch {
      preview.className = "hidden";
    }
  }

  async function procesarArchivo(file) {
    limpiarAyuda();
    if (!MEDIA_TYPES.includes(file.type)) {
      setOcrStatus(status, "error", { errorText: "Solo se aceptan imágenes JPG/PNG, PDF, HEIC o DNG." });
      return;
    }
    setOcrStatus(status, "loading");
    try {
      const base64 = await readFileAsBase64Fn(file);
      archivo = { base64, mime: file.type };
      const datos = await extraerGastoFn({ base64, mediaType: file.type });
      mostrarPreview(file);
      setOcrStatus(status, "success");
      onExtraido(datos);
    } catch (err) {
      if (err.code === "file_too_large") {
        // El archivo se descarta: el flujo de conversión volverá a llamar a
        // procesarArchivo con la versión reducida, y esa es la que hay que
        // adjuntar. Guardar la grande la haría fallar también al subirla.
        archivo = null;
        setOcrStatus(status, "hidden");
        help.className = "";
        help.appendChild(buildFileTooLargeHelp(file, { onConvertido: procesarArchivo }));
        return;
      }
      // El OCR falló, pero el archivo sigue valiendo: se enseña igualmente
      // y se adjuntará al guardar. El admin rellena los campos a mano.
      mostrarPreview(file);
      setOcrStatus(status, "error");
    }
  }

  const botones = buildGastoUploadButtons({ onFileSelected: procesarArchivo });

  wrap.append(botones, status, help, preview);
  return { wrap, getArchivo: () => archivo };
}
