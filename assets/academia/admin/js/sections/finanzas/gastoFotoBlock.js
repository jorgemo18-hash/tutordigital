import { uploadFotoGasto } from "../../apiFinanzas.js";
import { readFileAsBase64 } from "../../fileUtils.js";
import { setOcrStatus } from "../../ocrStatusBanner.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function esPdf(fotoUrl) {
  const url = fotoUrl.toLowerCase();
  return url.split("?")[0].endsWith(".pdf") || url.includes("%2epdf");
}

function buildFotoDisplay(fotoUrl) {
  const wrap = document.createElement("div");
  wrap.className = "ac-gasto-foto-wrap";
  if (esPdf(fotoUrl)) {
    const iframe = document.createElement("iframe");
    iframe.src = fotoUrl;
    iframe.width = "100%";
    iframe.height = "300px";
    iframe.className = "ac-gasto-foto-pdf-iframe";
    wrap.appendChild(iframe);

    const link = document.createElement("a");
    link.href = fotoUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "ac-gasto-foto-pdf-link";
    link.textContent = "📄 Ver factura (PDF)";
    wrap.appendChild(link);
  } else {
    const img = document.createElement("img");
    img.src = fotoUrl;
    img.alt = "Factura";
    img.className = "ac-gasto-foto-img";
    img.style.cursor = "pointer";
    img.addEventListener("click", () => window.open(fotoUrl, "_blank"));
    wrap.appendChild(img);
  }
  return wrap;
}

// Foto de una factura en el drawer de detalle/edición de un gasto: si ya
// hay foto_url la muestra (imagen clicable, o enlace si es PDF); si no,
// muestra un botón "Subir factura" que sube el archivo directamente contra
// el gasto real (sin OCR, a diferencia de gastoUpload.js que se usa en
// modo creación) y vuelve a renderizar mostrando la foto ya subida.
export function buildGastoFotoBlock({ fotoUrl, gastoId, onFotoSubida, uploadFotoGastoFn = uploadFotoGasto }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-wrap";

  function render(url) {
    wrap.innerHTML = "";
    if (url) {
      wrap.appendChild(buildFotoDisplay(url));
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-drawer-upload-btn ac-drawer-upload-btn--active";
    btn.textContent = "📎 Subir factura";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,application/pdf";
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
        const base64 = await readFileAsBase64(file);
        const nuevaUrl = await uploadFotoGastoFn(gastoId, { base64, mime: file.type });
        onFotoSubida(nuevaUrl);
        render(nuevaUrl);
      } catch {
        setOcrStatus(status, "error");
      }
    });

    wrap.append(btn, input, status);
  }

  render(fotoUrl);
  return wrap;
}
