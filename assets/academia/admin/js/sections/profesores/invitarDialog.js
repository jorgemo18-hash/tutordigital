// Diálogo de "invitar profesor" — mismo overlay/panel que
// correccionDialog.js (fichajes), pero solo con email + nombre: un
// profesor de academia no tiene grupos ni asignaturas que asignar (ver
// admin-teachers/invite.routes.js, que salta esa exigencia para
// tenant.type === "academia"). Devuelve { email, display_name } o null.
export function abrirInvitarDialog() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ac-modal-overlay";

    const panel = document.createElement("div");
    panel.className = "ac-modal-panel";

    const titulo = document.createElement("p");
    titulo.className = "ac-modal-titulo";
    titulo.textContent = "Invitar profesor";
    panel.appendChild(titulo);

    const campoNombre = document.createElement("div");
    campoNombre.className = "ac-field";
    const labelNombre = document.createElement("label");
    labelNombre.className = "ac-field-label";
    labelNombre.textContent = "Nombre";
    const inputNombre = document.createElement("input");
    inputNombre.type = "text";
    inputNombre.className = "ac-input";
    inputNombre.placeholder = "Nombre y apellidos";
    campoNombre.append(labelNombre, inputNombre);
    panel.appendChild(campoNombre);

    const campoEmail = document.createElement("div");
    campoEmail.className = "ac-field";
    const labelEmail = document.createElement("label");
    labelEmail.className = "ac-field-label";
    labelEmail.textContent = "Email";
    const inputEmail = document.createElement("input");
    inputEmail.type = "email";
    inputEmail.className = "ac-input";
    inputEmail.placeholder = "profesor@ejemplo.com";
    campoEmail.append(labelEmail, inputEmail);
    panel.appendChild(campoEmail);

    const aviso = document.createElement("span");
    aviso.className = "ac-drawer-msg error";
    panel.appendChild(aviso);

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

    const invitarBtn = document.createElement("button");
    invitarBtn.type = "button";
    invitarBtn.className = "ac-btn primary";
    invitarBtn.textContent = "Enviar invitación";
    invitarBtn.addEventListener("click", () => {
      const email = inputEmail.value.trim();
      const displayName = inputNombre.value.trim();
      if (!displayName) {
        aviso.textContent = "El nombre es obligatorio.";
        return;
      }
      if (!email || !email.includes("@")) {
        aviso.textContent = "Introduce un email válido.";
        return;
      }
      cerrar({ email, display_name: displayName });
    });
    acciones.appendChild(invitarBtn);

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
    inputNombre.focus();
  });
}
