import { uploadFichaAlumno, descargarFichaAlumno, extraerInscripcion } from "../../api.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";
import { crearVisorAdjunto } from "../../upload/archivoAdjunto.js";
import { comparaFicha, hayDiferencias, CAMPOS_ALUMNO, CAMPOS_FAMILIA } from "./comparaFicha.js";
import { dialogoComparaFicha } from "./dialogoComparaFicha.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];

// La ficha de inscripción en papel de un alumno YA existente: si la tiene la
// enseña (clic = tamaño completo); si no, un botón para subirla.
//
// AHORA TAMBIÉN SE LEE. Antes se subía y se guardaba sin pasar por el OCR,
// con el argumento de que "los datos ya están escritos y lo que falta es el
// documento". Jorge, 23/09: *"he creado un alumno con datos falsos para que
// me salga ya en el horario porque ha empezado, pero no tengo la ficha, y
// cuando me la dan, al subirla no cambia lo que hay"*. La premisa era falsa
// justo en el caso más común: el alumno empieza antes de que llegue el papel.
//
// EL ORDEN ES SUBIR PRIMERO Y LEER DESPUÉS, y no al revés. El documento es
// lo que no se puede perder —es lo que hay que enseñar si una familia
// discute lo que firmó— así que se guarda antes de nada. Si el OCR falla o
// el admin cancela la comparación, la foto ya está a salvo.
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
  // Lo que hay guardado AHORA, para comparar. Los getters y no los valores
  // porque el admin puede haber editado los campos del drawer entre que
  // abre la ficha y sube la foto: comparar contra lo que había al abrir
  // enseñaría diferencias que ya no existen.
  getDatosActuales = () => ({ alumno: {}, familia: {} }),
  onDatosDeFicha = null,
  uploadFichaAlumnoFn = uploadFichaAlumno,
  descargarFichaFn = descargarFichaAlumno,
  readFileAsBase64Fn = readFileAsBase64,
  extraerInscripcionFn = extraerInscripcion,
  dialogoComparaFichaFn = dialogoComparaFicha,
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

  // Lee la ficha recién subida y, si dice algo distinto, lo pregunta.
  //
  // NO ROMPE LA SUBIDA SI FALLA. El OCR es lo secundario aquí: la foto ya
  // está guardada, y perder ese resultado porque el reconocimiento de texto
  // no acertó —o porque la academia no tiene el OCR configurado— sería tirar
  // lo importante por lo accesorio. Mismo criterio que en el alta nueva
  // (inscripcionUpload.js), pero allí el OCR es lo principal y aquí no.
  //
  // Sin `onDatosDeFicha` no se lee nada: quien no pueda aplicar los datos no
  // debe enseñar una lista de cambios que después no puede hacer.
  async function compararConLaFicha(archivo) {
    if (!onDatosDeFicha) return;
    let leido = null;
    try {
      leido = await extraerInscripcionFn({ base64: archivo.base64, mediaType: archivo.mime });
    } catch {
      return;
    }
    const actuales = getDatosActuales() || {};
    const alumno = comparaFicha(actuales.alumno || {}, leido?.alumno || {}, CAMPOS_ALUMNO);
    const familia = comparaFicha(actuales.familia || {}, leido?.familia || {}, CAMPOS_FAMILIA);
    // SIN DIFERENCIAS NO SE PREGUNTA NADA. Un diálogo que dice "no hay
    // cambios" es un clic de más cada vez que se archiva la hoja firmada de
    // un alumno cuyos datos ya estaban bien, que es el caso normal.
    if (!hayDiferencias(alumno, familia)) return;
    const elegido = await dialogoComparaFichaFn({ alumno, familia });
    if (!elegido) return;
    onDatosDeFicha(elegido);
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
        await compararConLaFicha({ base64, mime: file.type });
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
