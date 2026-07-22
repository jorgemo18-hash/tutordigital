// Diálogo genérico de "elige una acción" — usado por cabecera.js (nivel
// mes) y acciones/accionesFamiliaBoton.js (nivel familia, con opciones "por
// alumno" de nombre dinámico) para los botones "Regenerar"/"Enviar".
// Deliberadamente separado del aviso forward-only de confirmarYEjecutar.js
// ("ya se envió/pagó, ¿seguro?"): este resuelve una pregunta distinta y se
// muestra ANTES, nunca se combinan en un solo diálogo.
//
// `opciones`: lista de objetos con al menos `{ label }` — el resto de
// claves (p.ej. `tipo`, `alumnoId`) son del llamador, se devuelven tal
// cual. La primera opción es la de por defecto (con foco, para que el
// caso normal se resuelva con un clic + Enter); el resto se pinta como
// alternativa. Devuelve la opción elegida, o null si se cancela (Escape,
// clic fuera, botón Cancelar) — nunca lanza.
export function elegirAccion({ titulo, opciones }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ac-modal-overlay";

    const panel = document.createElement("div");
    panel.className = "ac-modal-panel";

    const tituloEl = document.createElement("p");
    tituloEl.className = "ac-modal-titulo";
    tituloEl.textContent = titulo;
    panel.appendChild(tituloEl);

    const acciones = document.createElement("div");
    acciones.className = "ac-modal-acciones";

    function cerrar(valor) {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      resolve(valor);
    }
    function onKeydown(e) {
      if (e.key === "Escape") cerrar(null);
    }

    let botonDefecto = null;
    opciones.forEach((opcion, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ac-btn ${i === 0 ? "primary" : "copper"}`;
      btn.textContent = opcion.label;
      btn.addEventListener("click", () => cerrar(opcion));
      acciones.appendChild(btn);
      if (i === 0) botonDefecto = btn;
    });

    const cancelarBtn = document.createElement("button");
    cancelarBtn.type = "button";
    cancelarBtn.className = "ac-btn ghost";
    cancelarBtn.textContent = "Cancelar";
    cancelarBtn.addEventListener("click", () => cerrar(null));
    acciones.appendChild(cancelarBtn);

    panel.appendChild(acciones);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(null); });
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlay);
    botonDefecto?.focus();
  });
}
