const OPCIONES = [
  { tipo: "completo", label: "Recibo + informes" },
  { tipo: "solo_recibo", label: "Solo recibo" },
  { tipo: "solo_informe", label: "Solo informe(s)" },
];

// Diálogo de 3 opciones para elegir QUÉ enviar — deliberadamente separado
// del aviso forward-only de regenerarBoton.js ("ya se envió, ¿seguro?"):
// este resuelve una pregunta distinta y se muestra ANTES, nunca se
// combinan en un solo diálogo. "Recibo + informes" es la opción por
// defecto (con foco) para que el caso normal se resuelva con un clic +
// Enter; "Solo recibo"/"Solo informe(s)" cubren la excepción. Devuelve el
// tipo elegido, o null si se cancela (Escape, clic fuera, botón
// Cancelar) — nunca lanza.
export function elegirTipoEnvio() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ac-modal-overlay";

    const panel = document.createElement("div");
    panel.className = "ac-modal-panel";

    const titulo = document.createElement("p");
    titulo.className = "ac-modal-titulo";
    titulo.textContent = "¿Qué quieres enviar?";
    panel.appendChild(titulo);

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
    for (const { tipo, label } of OPCIONES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ac-btn ${tipo === "completo" ? "primary" : "copper"}`;
      btn.textContent = label;
      btn.addEventListener("click", () => cerrar(tipo));
      acciones.appendChild(btn);
      if (tipo === "completo") botonDefecto = btn;
    }

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
