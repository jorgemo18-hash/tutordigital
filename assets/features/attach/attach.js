// assets/features/attach/attach.js
// Encapsula la UI de adjuntos (botón +, menú, selector de archivo) y avisa con onFile(file)

export function initAttach({ onFile } = {}) {
  const moreBtn = document.getElementById("more");
  const menu = document.getElementById("moreMenu");
  const filePick = document.getElementById("filePick");

  if (!moreBtn || !menu || !filePick) {
    console.warn("initAttach: faltan #more, #moreMenu o #filePick");
    return;
  }

  function openMenu() {
    menu.classList.add("show");
    menu.setAttribute("aria-hidden", "false");
  }

  function closeMenu() {
    menu.classList.remove("show");
    menu.setAttribute("aria-hidden", "true");
  }

  function toggleMenu() {
    if (menu.classList.contains("show")) closeMenu();
    else openMenu();
  }

  // Toggle menú al pulsar +
  moreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  // Cerrar menú al click fuera
  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("show")) return;
    const insideMenu = e.target && (e.target.closest("#moreMenu") || e.target.closest("#more"));
    if (!insideMenu) closeMenu();
  });

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Acciones del menú: cámara / foto
  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;

    // Reinicia selector para que dispare change aunque elijas el mismo archivo
    filePick.value = "";

    // iOS/Safari: capture puede abrir cámara; en desktop lo ignorará
    if (act === "camera") {
      filePick.setAttribute("capture", "environment");
    } else {
      filePick.removeAttribute("capture");
    }

    closeMenu();

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