// Indicador "Leyendo el ejercicio" que se muestra en la columna izquierda
// mientras el Guía procesa. Recibe el contenedor donde insertarse en vez de
// buscarlo por su cuenta.
export function buildSessionLoadingIndicator(containerEl) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;align-items:center;gap:8px;margin:8px 0 0 0;padding:0 2px;";
  el.innerHTML = `
    <span style="font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:12px;color:rgba(196,131,74,0.85);">Leyendo el ejercicio</span>
    <div class="typingDots" style="gap:4px;" aria-hidden="true"><span></span><span></span><span></span></div>`;
  el.hidden = true;
  try { containerEl?.appendChild(el); } catch {}
  return el;
}
