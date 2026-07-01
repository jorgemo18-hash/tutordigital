import { extraerGasto, uploadFotoGasto } from "../../apiFinanzas.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";
import { buildGastoUploadButtons } from "./gastoUpload/buttons.js";
import { buildFileTooLargeHelp } from "./gastoUpload/tooLargeHelp.js";
import { buildFotoDisplay } from "./gastoFotoPreview.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// Botones "Hacer foto" / "Subir archivo" — capturan/seleccionan una foto o
// PDF de una factura/ticket de gasto, la envían a OCR y entregan el JSON
// extraído (con foto_url añadido, si la subida del archivo original tuvo
// éxito) vía `onExtraido`. Si el OCR rechaza el archivo por tamaño, se
// muestra ayuda para convertirlo en vez del error genérico — mismo patrón
// que inscripcionUpload.js (drawer de alumno) para el resto de errores.
export function buildGastoUpload({ onExtraido, extraerGastoFn = extraerGasto, uploadFotoGastoFn = uploadFotoGasto } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  const status = document.createElement("div");
  setOcrStatus(status, "hidden");

  const help = document.createElement("div");
  help.className = "hidden";

  const preview = document.createElement("div");
  preview.className = "hidden";

  function limpiarAyuda() {
    help.innerHTML = "";
    help.className = "hidden";
  }

  // Vista previa a partir del propio File en memoria — no depende de que la
  // subida a Storage (uploadFotoGastoFn) haya terminado ni tenga éxito, así
  // que aparece igual de rápido tanto si esa subida falla como si tarda.
  function mostrarPreview(file) {
    preview.innerHTML = "";
    preview.className = "";
    preview.appendChild(buildFotoDisplay(URL.createObjectURL(file), { esPdf: file.type === "application/pdf" }));
  }

  async function procesarArchivo(file) {
    limpiarAyuda();
    if (!MEDIA_TYPES.includes(file.type)) {
      setOcrStatus(status, "error", { errorText: "Solo se aceptan imágenes JPG/PNG, PDF, HEIC o DNG." });
      return;
    }
    setOcrStatus(status, "loading");
    try {
      const base64 = await readFileAsBase64(file);
      const datos = await extraerGastoFn({ base64, mediaType: file.type });
      try {
        // El gasto aún no existe — se sube con un id temporal solo para
        // tener ya la URL pública lista; al guardar, foto_url se manda en
        // el POST de creación (ver gastoFormFields.js/gastoDrawer.js). Si
        // la subida falla, se sigue con los datos de texto igualmente: la
        // foto es secundaria frente al OCR.
        datos.foto_url = await uploadFotoGastoFn(crypto.randomUUID(), { base64, mime: file.type });
      } catch {
        // ignorado a propósito, ver comentario de arriba
      }
      mostrarPreview(file);
      setOcrStatus(status, "success");
      onExtraido(datos);
    } catch (err) {
      if (err.code === "file_too_large") {
        setOcrStatus(status, "hidden");
        help.className = "";
        help.appendChild(buildFileTooLargeHelp(file, { onConvertido: procesarArchivo }));
        return;
      }
      setOcrStatus(status, "error");
    }
  }

  const botones = buildGastoUploadButtons({ onFileSelected: procesarArchivo });

  wrap.append(botones, status, help, preview);
  return wrap;
}
