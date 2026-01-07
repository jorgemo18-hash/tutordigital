// assets/features/attach/attach.js
// Encapsula la UI de adjuntos (botón + y selector de archivo) y avisa con onFile(file)

export function initAttach({ onFile } = {}) {
  const moreBtn = document.getElementById("more");
  const filePick = document.getElementById("filePick");

  if (!moreBtn || !filePick) {
    console.warn("initAttach: faltan #more o #filePick");
    return;
  }

  // Click en + -> abrir selector nativo (única vía: sin menú Cámara/Foto)
  moreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Reinicia selector para que dispare change aunque elijas el mismo archivo
    filePick.value = "";

    // No forzar cámara (si existiese capture, iOS lo respeta)
    filePick.removeAttribute("capture");

    // abre selector nativo
    filePick.click();
  });

  // Cuando el usuario elige una imagen
  filePick.addEventListener("change", () => {
    const file = filePick.files && filePick.files[0];
    if (!file) return;

    // Solo imágenes
    if (!/^image\//.test(file.type)) return;

    try {
      if (typeof onFile === "function") onFile(file);
    } catch (err) {
      console.error(err);
    }
  });
}