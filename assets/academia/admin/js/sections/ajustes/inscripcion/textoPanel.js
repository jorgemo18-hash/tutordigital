import { fetchTextoInscripcion, guardarTextoInscripcion, extraerTextoInscripcion } from "../../../apiDocumentos.js";
import { readFileAsBase64 } from "../../../fileUtils.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";

const DOCUMENTO_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const HINT_DEFAULT = "Si se deja vacío, la hoja de inscripción se genera sin cara trasera";

// "Protección de datos (cara trasera)" — dos vías de entrada (subir un
// PDF/DOCX y que el backend extraiga su texto, o escribirlo/pegarlo a
// mano) hacia el mismo destino: el texto de academia_textos_legales tipo
// 'inscripcion' (ver inscripcionTexto.routes.js). Solo se guarda el
// texto — el archivo subido nunca se persiste. Subir un documento ya
// guarda el texto extraído de inmediato (ver extraerTextoInscripcion en
// el backend); el botón "Guardar" es para cuando se edita a mano después,
// o se escribe directamente sin subir nada.
export function buildTextoPanel({
  fetchTextoFn = fetchTextoInscripcion,
  guardarTextoFn = guardarTextoInscripcion,
  extraerTextoFn = extraerTextoInscripcion,
} = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(
    buildPanelHead(
      "Protección de datos (cara trasera)",
      "Texto legal que se imprime en la cara trasera de la hoja de inscripción. Sube un documento o escríbelo directamente."
    )
  );

  const subirRow = document.createElement("div");
  subirRow.className = "ac-inscripcion-subir-row";
  const subirBtn = document.createElement("button");
  subirBtn.type = "button";
  subirBtn.className = "ac-btn ghost";
  subirBtn.textContent = "Subir documento";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  input.className = "ac-upload-input";
  subirRow.append(subirBtn, input);
  panel.appendChild(subirRow);

  const textarea = document.createElement("textarea");
  textarea.className = "ac-textarea";
  textarea.rows = 12;
  textarea.placeholder = "Pega o escribe aquí el texto de protección de datos, o sube un PDF/DOCX arriba.";
  panel.appendChild(textarea);

  const { foot, hint } = buildPanelFoot(HINT_DEFAULT);
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.textContent = "Guardar";
  foot.appendChild(saveBtn);
  panel.appendChild(foot);

  function mostrarMensaje(texto, ms = 1700) {
    hint.textContent = texto;
    setTimeout(() => { hint.textContent = HINT_DEFAULT; }, ms);
  }

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      await guardarTextoFn(textarea.value.trim());
      mostrarMensaje("✓ Guardado");
    } catch (err) {
      mostrarMensaje(err.message || "No se pudo guardar.");
    }
    saveBtn.disabled = false;
  });

  subirBtn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!DOCUMENTO_MIMES.includes(file.type)) {
      mostrarMensaje("Solo se aceptan documentos PDF o DOCX.");
      return;
    }
    subirBtn.disabled = true;
    hint.textContent = "Extrayendo texto…";
    try {
      const base64 = await readFileAsBase64(file);
      const contenido = await extraerTextoFn({ base64, mime: file.type });
      textarea.value = contenido;
      mostrarMensaje("✓ Guardado");
    } catch (err) {
      mostrarMensaje(err.message || "No se pudo extraer el texto del documento.");
    }
    subirBtn.disabled = false;
  });

  fetchTextoFn()
    .then((contenido) => { textarea.value = contenido; })
    .catch((err) => { hint.textContent = err.message || "No se pudo cargar el texto guardado."; });

  return panel;
}
