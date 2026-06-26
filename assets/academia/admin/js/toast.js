let hideTimeout = null;

// Toast simple, una sola instancia reutilizada — vive en document.body
// independiente de qué sección esté activa. `duracionMs` se puede ajustar
// por llamada si algún mensaje necesita quedarse más tiempo visible.
export function showToast(texto, { duracionMs = 5000 } = {}) {
  let el = document.getElementById("acToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "acToast";
    el.className = "ac-toast";
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.classList.add("ac-toast--visible");

  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    el.classList.remove("ac-toast--visible");
  }, duracionMs);
}
