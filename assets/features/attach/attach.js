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

  const isMobile = isMobileish(isMobileMaxWidth);

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

  // --- Comportamiento del botón + ---
  if (!isMobile) {
    // DESKTOP: + abre directamente selector (sin menú)
    if (menu) closeMenu();
    moreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPicker("photo");
    });
  } else {
    // MÓVIL: + abre menú Cámara/Foto
    if (menu) {
      // En móvil queremos menú (tu HTML ya lo trae, pero lo aseguramos)
      menu.innerHTML = `
        <button type="button" data-act="camera">📷 Cámara</button>
        <button type="button" data-act="photo">🖼️ Foto</button>
      `;
      closeMenu();

      moreBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleMenu();
      });

      document.addEventListener("click", (e) => {
        // cerrar al click fuera
        if (moreBtn.contains(e.target) || menu.contains(e.target)) return;
        closeMenu();
      });

      menu.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-act]");
        if (!b) return;
        openPicker(b.dataset.act === "camera" ? "camera" : "photo");
        closeMenu();
      });
    } else {
      // fallback: si no hay menú, abre galería
      moreBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openPicker("photo");
      });
    }
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