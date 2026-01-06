// assets/features/attach/attach.js
// Feature: image attach picker (camera / photo library) + mobile-friendly behavior
// Exports: initAttach({ onFile })

export function initAttach({ onFile } = {}) {
  const filePick = document.getElementById("filePick");
  const moreBtn = document.getElementById("more");
  const moreMenu = document.getElementById("moreMenu");

  if (!filePick) {
    console.warn("[attach] #filePick no existe. Revisa app.html");
    return;
  }

  // --- helpers ---
  function openPicker({ capture } = {}) {
    // capture: "environment" | "user" | undefined
    // iOS Safari: capture suele abrir cámara; sin capture abre fototeca/selector
    if (capture) filePick.setAttribute("capture", capture);
    else filePick.removeAttribute("capture");

    // Resetea para que seleccionar la misma foto vuelva a disparar change
    filePick.value = "";
    filePick.click();

    // UX: devuelve el foco al input tras abrir selector
    setTimeout(() => {
      const inp = document.getElementById("inp");
      inp && inp.focus();
    }, 0);
  }

  function closeMenu() {
    if (!moreMenu) return;
    moreMenu.classList.remove("show");
    moreMenu.setAttribute("aria-hidden", "true");
  }

  function toggleMenu() {
    if (!moreMenu) return;
    const willShow = !moreMenu.classList.contains("show");
    if (willShow) {
      moreMenu.classList.add("show");
      moreMenu.setAttribute("aria-hidden", "false");
    } else {
      closeMenu();
    }
  }

  // --- menu button (+) ---
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    // clicks inside menu
    moreMenu.addEventListener("click", (e) => {
      const act = e.target?.closest("button[data-act]")?.dataset?.act;
      if (!act) return;

      // "camera" -> cámara trasera; "photo" -> fototeca
      if (act === "camera") openPicker({ capture: "environment" });
      if (act === "photo") openPicker({ capture: undefined });

      closeMenu();
    });

    // close on outside click
    document.addEventListener("click", (e) => {
      if (!moreMenu.classList.contains("show")) return;
      const inside = e.target.closest(".moreWrap");
      if (!inside) closeMenu();
    });
  }

  // --- file picked ---
  filePick.addEventListener("change", () => {
    const file = filePick.files && filePick.files[0];
    if (!file) return;

    try {
      if (typeof onFile === "function") onFile(file);
    } finally {
      // Limpia el valor para permitir re-selección del mismo archivo
      filePick.value = "";

      // Devuelve el foco al input para escribir
      setTimeout(() => {
        const inp = document.getElementById("inp");
        inp && inp.focus();
      }, 0);
    }
  });
}