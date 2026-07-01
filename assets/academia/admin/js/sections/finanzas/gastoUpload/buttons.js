const CAMERA_ACCEPT = "image/jpeg,image/png";
const FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif,image/x-adobe-dng,image/dng,.dng";

function buildButton(label, className) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  return btn;
}

function buildInput({ accept, capture }) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  if (capture) input.capture = capture;
  input.className = "ac-upload-input";
  return input;
}

function wireInput(input, onFileSelected) {
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) onFileSelected(file);
  });
}

// Dos botones de subida, siempre presentes en el DOM: "Hacer foto" fuerza
// JPEG/PNG vía la cámara del móvil (capture=environment no tiene efecto en
// escritorio, por eso .ac-gasto-camera-btn se oculta ahí por CSS, no por JS)
// y "Subir archivo" acepta cualquier formato soportado (JPG/PNG/WEBP/PDF/
// HEIC/DNG) desde galería o disco, sin capture, visible siempre.
export function buildGastoUploadButtons({ onFileSelected }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-drawer-upload-buttons";

  const cameraBtn = buildButton("📷 Hacer foto", "ac-drawer-upload-btn ac-drawer-upload-btn--active ac-gasto-camera-btn");
  const cameraInput = buildInput({ accept: CAMERA_ACCEPT, capture: "environment" });
  cameraBtn.addEventListener("click", () => cameraInput.click());
  wireInput(cameraInput, onFileSelected);

  const fileBtn = buildButton("📎 Subir archivo", "ac-drawer-upload-btn ac-drawer-upload-btn--active");
  const fileInput = buildInput({ accept: FILE_ACCEPT });
  fileBtn.addEventListener("click", () => fileInput.click());
  wireInput(fileInput, onFileSelected);

  wrap.append(cameraBtn, cameraInput, fileBtn, fileInput);
  return wrap;
}
