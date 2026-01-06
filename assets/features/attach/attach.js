// assets/features/attach/attach.js
export function initAttach({
  moreBtnId = "more",
  menuId = "moreMenu",
  inputId = "filePick",
  isMobileMaxWidth = 820,
  onFile, // (file, meta) => void
} = {}) {
  const moreBtn = document.getElementById(moreBtnId);
  const menu = document.getElementById(menuId);
  const filePick = document.getElementById(inputId);

  if (!moreBtn || !filePick) return; // sin botón o sin input, no hay attach

  function openPicker(mode) {
    // Siempre imágenes
    filePick.setAttribute("accept", "image/*");

    // En móvil intentamos diferenciar cámara vs galería con capture
    if (mode === "camera") {
      filePick.setAttribute("capture", "environment");
    } else {
      filePick.removeAttribute("capture");
    }

    filePick.click();
  }

  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("show");
    menu.setAttribute("aria-hidden", "true");
  }

  function toggleMenu() {
    if (!menu) return;
    const open = menu.classList.toggle("show");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
  }

  // --- Comportamiento del botón + (igual en desktop y móvil) ---
  if (menu) closeMenu();
  moreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    // En móvil el navegador ya ofrece Fototeca / Hacer foto / Archivos
    openPicker("photo");
  });

  // Si existe menú, por si acaso, lo cerramos al click fuera
  if (menu) {
    document.addEventListener("click", (e) => {
      if (moreBtn.contains(e.target) || menu.contains(e.target)) return;
      closeMenu();
    });
  }

  // --- Cuando el usuario selecciona un archivo ---
  filePick.addEventListener("change", () => {
    const file = filePick.files?.[0];
    if (!file) return;

    // Resetea para poder elegir el mismo archivo dos veces seguidas
    filePick.value = "";

    if (typeof onFile === "function") {
      onFile(file, { kind: "image" });
    }
  });
}

function isMobileish(maxWidth) {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const smallScreen = window.matchMedia?.(`(max-width: ${maxWidth}px)`)?.matches ?? false;
  return hasTouch && smallScreen;
}