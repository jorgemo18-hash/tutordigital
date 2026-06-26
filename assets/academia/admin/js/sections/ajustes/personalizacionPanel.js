import { fetchConfig, updateConfig, uploadLogo, uploadBg } from "../../api.js";
import { readFileAsBase64 } from "../../fileUtils.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Campo de imagen con preview inmediata (object URL del archivo elegido) y
// subida automática en cuanto se confirma la selección — sin paso de
// "Guardar" aparte, igual que la ficha de inscripción (inscripcionUpload.js).
function buildImagenField({ label, botonTexto, valorInicial, uploadFn }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);

  const preview = document.createElement("img");
  preview.className = "ac-asset-preview";
  preview.hidden = !valorInicial;
  if (valorInicial) preview.src = valorInicial;
  wrap.appendChild(preview);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-drawer-upload-btn ac-drawer-upload-btn--active";
  btn.textContent = botonTexto;
  wrap.appendChild(btn);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "ac-upload-input";
  wrap.appendChild(input);

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";
  wrap.appendChild(msg);

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
    preview.src = localUrl;
    preview.hidden = false;
    btn.disabled = true;
    msg.textContent = "";
    try {
      const base64 = await readFileAsBase64(file);
      const url = await uploadFn({ base64, mime: file.type });
      preview.src = url;
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
} = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  const title = document.createElement("div");
  title.className = "ac-panel-title";
  title.textContent = "Personalización";
  panel.appendChild(title);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    panel.appendChild(
      buildImagenField({ label: "Logo", botonTexto: "Subir logo", valorInicial: config.logo_url, uploadFn: uploadLogoFn })
    );
    panel.appendChild(
      buildImagenField({
        label: "Foto de fondo",
        botonTexto: "Subir foto de fondo",
        valorInicial: config.bg_url,
        uploadFn: uploadBgFn,
      })
    );

    const lopd = buildLopdField(config.texto_lopd);
    panel.appendChild(lopd.wrap);

    const msg = document.createElement("div");
    msg.className = "ac-drawer-msg";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      msg.textContent = "";
      try {
        await updateConfigFn({ texto_lopd: lopd.input.value.trim() });
        msg.textContent = "✓ Guardado";
        msg.className = "ac-drawer-msg ok";
      } catch (err) {
        msg.textContent = err.message || "No se pudo guardar.";
        msg.className = "ac-drawer-msg error";
      }
      saveBtn.disabled = false;
    });
    panel.append(saveBtn, msg);
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}
