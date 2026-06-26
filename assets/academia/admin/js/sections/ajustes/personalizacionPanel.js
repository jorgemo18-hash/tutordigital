import { fetchConfig, updateConfig, uploadLogo, uploadBg } from "../../api.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { aplicarFondoGlobal, aplicarLogoGlobal } from "./personalizacionDom.js";
import { buildPanelHead, buildPanelFoot } from "./panelChrome.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

function buildPreviewTile(valorInicial, placeholderTexto) {
  const tile = document.createElement("div");
  tile.className = "ac-upload-preview";
  const img = document.createElement("img");
  img.hidden = !valorInicial;
  if (valorInicial) img.src = valorInicial;
  const ph = document.createElement("div");
  ph.className = "ac-ph";
  ph.hidden = Boolean(valorInicial);
  const phSpan = document.createElement("span");
  phSpan.textContent = placeholderTexto;
  ph.appendChild(phSpan);
  tile.append(img, ph);
  return { tile, img, ph };
}

// Tile de imagen con preview inmediata (object URL del archivo elegido) y
// subida automática en cuanto se confirma la selección — sin paso de
// "Guardar" aparte, igual que la ficha de inscripción (inscripcionUpload.js).
// `onSubido` recibe la URL final y aplica el cambio al resto del DOM (ver
// personalizacionDom.js) — esta función no sabe nada de .ac-photo ni de
// .ef-preview-logo, solo gestiona el campo y delega esa parte al llamador.
function buildImagenField({ label, placeholderTexto, hint, valorInicial, uploadFn, onSubido }) {
  const wrap = document.createElement("div");

  const section = document.createElement("div");
  section.className = "ac-section-label";
  section.textContent = label;
  wrap.appendChild(section);

  const upload = document.createElement("div");
  upload.className = "ac-upload";
  const { tile, img, ph } = buildPreviewTile(valorInicial, placeholderTexto);
  upload.appendChild(tile);

  const side = document.createElement("div");
  side.className = "ac-upload-side";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn";
  btn.textContent = "→ Subir archivo";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "ac-upload-input";
  const hintEl = document.createElement("div");
  hintEl.className = "ac-upload-hint";
  hintEl.textContent = hint;
  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";
  side.append(btn, input, hintEl, msg);
  upload.appendChild(side);
  wrap.appendChild(upload);

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!MEDIA_TYPES.includes(file.type)) {
      msg.textContent = "Solo se aceptan imágenes JPG, PNG o WEBP.";
      msg.className = "ac-drawer-msg error";
      return;
    }
    const localUrl = URL.createObjectURL(file);
    img.src = localUrl;
    img.hidden = false;
    ph.hidden = true;
    btn.disabled = true;
    msg.textContent = "";
    try {
      const base64 = await readFileAsBase64(file);
      const url = await uploadFn({ base64, mime: file.type });
      img.src = url;
      onSubido?.(url);
      msg.textContent = "✓ Guardado";
      msg.className = "ac-drawer-msg ok";
    } catch (err) {
      msg.textContent = err.message || "No se pudo subir la imagen.";
      msg.className = "ac-drawer-msg error";
    }
    URL.revokeObjectURL(localUrl);
    btn.disabled = false;
  });

  return wrap;
}

function buildLopdField(valorInicial) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = "Texto LOPD";
  wrap.appendChild(span);
  const textarea = document.createElement("textarea");
  textarea.className = "ac-textarea";
  textarea.rows = 3;
  textarea.value = valorInicial || "";
  wrap.appendChild(textarea);
  const ayuda = document.createElement("p");
  ayuda.className = "ac-field-help";
  ayuda.textContent = "Aparece en el footer de todos los emails de recibo.";
  wrap.appendChild(ayuda);
  return { wrap, input: textarea };
}

// Logo + foto de fondo (subida automática) y texto LOPD (se guarda con el
// botón "Guardar" de la tarjeta, igual que el resto de paneles de Ajustes).
export function buildPersonalizacionPanel({
  fetchConfigFn = fetchConfig,
  updateConfigFn = updateConfig,
  uploadLogoFn = uploadLogo,
  uploadBgFn = uploadBg,
  onLogoActualizado,
  onBgActualizado,
} = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Personalización", "Logo y fotografía que dan identidad al panel y a los documentos."));

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    panel.appendChild(
      buildImagenField({
        label: "Logo",
        placeholderTexto: "Logo",
        hint: "PNG o SVG con fondo transparente. Mínimo 240×240 px.",
        valorInicial: config.logo_url,
        uploadFn: uploadLogoFn,
        // Aplica al DOM ya montado (banda del recibo, si está visible) y
        // avisa al llamador para que actualice también su copia en memoria
        // de la config — ver renderAjustesSection/academiaAdmin.js.
        onSubido: (url) => {
          aplicarLogoGlobal(url);
          onLogoActualizado?.(url);
        },
      })
    );
    panel.appendChild(
      buildImagenField({
        label: "Foto de fondo",
        placeholderTexto: "Imagen",
        hint: "JPG horizontal. Se aplica un velo cálido oscuro automáticamente.",
        valorInicial: config.bg_url,
        uploadFn: uploadBgFn,
        onSubido: (url) => {
          aplicarFondoGlobal(url);
          onBgActualizado?.(url);
        },
      })
    );

    const lopd = buildLopdField(config.texto_lopd);
    panel.appendChild(lopd.wrap);

    const { foot, hint } = buildPanelFoot("Se aplica a todo el panel");
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      const hintOriginal = hint.textContent;
      try {
        await updateConfigFn({ texto_lopd: lopd.input.value.trim() });
        hint.textContent = "✓ Guardado";
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
      setTimeout(() => { hint.textContent = hintOriginal; }, 1700);
    });
    foot.appendChild(saveBtn);
    panel.appendChild(foot);
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}
