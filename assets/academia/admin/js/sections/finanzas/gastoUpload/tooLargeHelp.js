import { convertirHeicFileAJpeg } from "./heicClient.js";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

function esDng(file) {
  return file.type === "image/x-adobe-dng" || file.type === "image/dng" || /\.dng$/i.test(file.name || "");
}

function buildCloudConvertLink(href, texto) {
  const box = document.createElement("div");
  box.className = "ac-banner red";
  box.append(document.createTextNode(`${texto} `));
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = href.replace(/^https:\/\//, "");
  box.appendChild(a);
  return box;
}

// Mensaje de ayuda cuando el backend rechaza el archivo por tamaño
// (code: file_too_large, >5MB tras conversión). HEIC se puede convertir en
// el propio navegador y reintentar automáticamente; DNG y el resto de
// formatos grandes necesitan un convertidor externo (CloudConvert).
export function buildFileTooLargeHelp(file, { onConvertido }) {
  if (HEIC_TYPES.has(file.type)) {
    const box = document.createElement("div");
    box.className = "ac-banner red";
    box.append(document.createTextNode("Archivo demasiado grande para procesar. "));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-drawer-upload-btn ac-drawer-upload-btn--active";
    btn.textContent = "Convertir a JPG";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Convirtiendo…";
      try {
        const jpegFile = await convertirHeicFileAJpeg(file);
        onConvertido(jpegFile);
      } catch {
        btn.disabled = false;
        btn.textContent = "Convertir a JPG";
        box.append(document.createTextNode(" No se pudo convertir automáticamente — usa cloudconvert.com."));
      }
    });
    box.appendChild(btn);
    return box;
  }

  if (esDng(file)) {
    return buildCloudConvertLink(
      "https://cloudconvert.com/dng-to-jpg",
      "Archivo DNG demasiado grande. Conviértelo gratis en:"
    );
  }

  return buildCloudConvertLink(
    "https://cloudconvert.com/image-converter",
    "Archivo demasiado grande. Conviértelo gratis en:"
  );
}
