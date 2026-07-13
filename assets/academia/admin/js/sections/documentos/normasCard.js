import { fetchNormas, uploadNormas } from "../../api.js";
import { readFileAsBase64 } from "../../fileUtils.js";

const NORMAS_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Tarjeta "Pack de bienvenida" (documento de normas propio, subido por el
// admin — PDF o DOCX). Al montar comprueba si ya existe un documento
// (fetchNormasFn): si lo hay, el botón principal pasa a "Reemplazar" y
// aparece "Ver normas"; si no, queda solo "Subir normas". "Ver normas"
// vuelve a pedir la URL firmada en cada click (en vez de reutilizar la del
// montaje) porque caduca a los 60 minutos y el panel puede quedarse
// abierto más tiempo que eso.
export function buildNormasCard({ fetchNormasFn = fetchNormas, uploadNormasFn = uploadNormas } = {}) {
  const card = document.createElement("div");
  card.className = "ac-doc-card";

  const title = document.createElement("div");
  title.className = "ac-doc-card-title";
  title.textContent = "Pack de bienvenida";

  const sub = document.createElement("div");
  sub.className = "ac-doc-card-sub";
  sub.textContent = "Normas del centro, horario tipo y datos de contacto";

  const actions = document.createElement("div");
  actions.className = "ac-doc-card-actions";

  const verBtn = document.createElement("button");
  verBtn.type = "button";
  verBtn.className = "ac-btn ghost hidden";
  verBtn.textContent = "Ver normas";

  const subirBtn = document.createElement("button");
  subirBtn.type = "button";
  subirBtn.className = "ac-btn ghost";
  subirBtn.textContent = "Subir normas";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  input.className = "ac-upload-input";

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";

  actions.append(verBtn, subirBtn, input);
  card.append(title, sub, actions, msg);

  let tieneNormas = false;

  function aplicarEstado() {
    verBtn.classList.toggle("hidden", !tieneNormas);
    subirBtn.textContent = tieneNormas ? "Reemplazar" : "Subir normas";
  }

  verBtn.addEventListener("click", async () => {
    verBtn.disabled = true;
    msg.textContent = "";
    msg.className = "ac-drawer-msg";
    // Mismo motivo que en hojaInscripcionCard.js: window.open() debe
    // llamarse síncrono dentro del click, antes del await, o Chrome lo
    // bloquea en silencio por haber perdido el gesto de usuario.
    const nuevaVentana = window.open("", "_blank");
    try {
      const normas = await fetchNormasFn();
      if (normas?.url && nuevaVentana) nuevaVentana.location.href = normas.url;
      else nuevaVentana?.close();
    } catch (err) {
      nuevaVentana?.close();
      msg.textContent = err.message || "No se pudo abrir el documento.";
      msg.className = "ac-drawer-msg error";
    }
    verBtn.disabled = false;
  });

  subirBtn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!NORMAS_MIMES.includes(file.type)) {
      msg.textContent = "Solo se aceptan documentos PDF o DOCX.";
      msg.className = "ac-drawer-msg error";
      return;
    }
    subirBtn.disabled = true;
    msg.textContent = "";
    msg.className = "ac-drawer-msg";
    try {
      const base64 = await readFileAsBase64(file);
      await uploadNormasFn({ base64, mime: file.type });
      tieneNormas = true;
      aplicarEstado();
      msg.textContent = "✓ Guardado";
      msg.className = "ac-drawer-msg ok";
    } catch (err) {
      msg.textContent = err.message || "No se pudo subir el documento.";
      msg.className = "ac-drawer-msg error";
    }
    subirBtn.disabled = false;
  });

  fetchNormasFn()
    .then((normas) => {
      tieneNormas = Boolean(normas?.url);
      aplicarEstado();
    })
    .catch((err) => {
      msg.textContent = err.message || "No se pudo comprobar si ya hay un documento subido.";
      msg.className = "ac-drawer-msg error";
    });

  return card;
}
