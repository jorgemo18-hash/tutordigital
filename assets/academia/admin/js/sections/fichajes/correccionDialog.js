// Diálogo de "añadir corrección" — mismo overlay/panel que
// elegirAccionDialog.js (envioFamilias), pero con un formulario en vez de
// una lista de botones: aquí hace falta capturar tipo + motivo, no elegir
// entre opciones fijas. Devuelve { tipo, motivo } o null si se cancela.
export function abrirCorreccionDialog({ tipoSugerido = "entrada" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ac-modal-overlay";

    const panel = document.createElement("div");
    panel.className = "ac-modal-panel";

    const titulo = document.createElement("p");
    titulo.className = "ac-modal-titulo";
    titulo.textContent = "Añadir corrección";
    panel.appendChild(titulo);

    const campoTipo = document.createElement("div");
    campoTipo.className = "ac-field";
    const labelTipo = document.createElement("label");
    labelTipo.className = "ac-field-label";
    labelTipo.textContent = "Tipo";
    const selectTipo = document.createElement("select");
    selectTipo.className = "ac-select";
    for (const [value, label] of [["entrada", "Entrada"], ["salida", "Salida"]]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.selected = value === tipoSugerido;
      selectTipo.appendChild(opt);
    }
    campoTipo.append(labelTipo, selectTipo);
    panel.appendChild(campoTipo);

    const campoMotivo = document.createElement("div");
    campoMotivo.className = "ac-field";
    const labelMotivo = document.createElement("label");
    labelMotivo.className = "ac-field-label";
    labelMotivo.textContent = "Motivo (obligatorio)";
    const textareaMotivo = document.createElement("textarea");
    textareaMotivo.className = "ac-textarea";
    textareaMotivo.rows = 3;
    campoMotivo.append(labelMotivo, textareaMotivo);
    panel.appendChild(campoMotivo);

    const avisoMotivo = document.createElement("span");
    avisoMotivo.className = "ac-drawer-msg error";
    panel.appendChild(avisoMotivo);

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

    const guardarBtn = document.createElement("button");
    guardarBtn.type = "button";
    guardarBtn.className = "ac-btn primary";
    guardarBtn.textContent = "Guardar corrección";
    guardarBtn.addEventListener("click", () => {
      const motivo = textareaMotivo.value.trim();
      if (!motivo) {
        avisoMotivo.textContent = "El motivo es obligatorio.";
        return;
      }
      cerrar({ tipo: selectTipo.value, motivo });
    });
    acciones.appendChild(guardarBtn);

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
    textareaMotivo.focus();
  });
}
