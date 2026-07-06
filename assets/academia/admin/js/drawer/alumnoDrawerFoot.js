// Construcción del pie del drawer de alumno (botones) — extraído de
// alumnoDrawer.js para no superar las 400 líneas al añadir "Eliminar
// definitivamente". Solo construye DOM; toda la lógica de guardado/borrado
// vive en alumnoDrawer.js y llega aquí como callbacks explícitos.

export function buildFootBtn(texto, clase) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${clase}`;
  btn.textContent = texto;
  return btn;
}

// Pie del drawer en modo confirmación inline para archivar — sin window.confirm.
export function buildArchivarConfirm(nombre, { onConfirmar, onCancelar }) {
  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";
  const texto = document.createElement("span");
  texto.className = "ac-drawer-msg";
  texto.textContent = `¿Archivar a ${nombre}?`;
  const right = document.createElement("div");
  right.className = "ac-drawer-foot-right";
  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.className = "ac-btn ghost";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", onCancelar);
  const siBtn = document.createElement("button");
  siBtn.type = "button";
  siBtn.className = "ac-btn danger";
  siBtn.textContent = "Sí, archivar";
  siBtn.addEventListener("click", onConfirmar);
  right.append(noBtn, siBtn);
  foot.append(texto, right);
  return foot;
}

// Una sola fila, siempre estos 3 botones en este orden — nunca el pie
// hace wrap (ver .ac-drawer-foot en el CSS, tamaño compacto a propósito).
export function buildFootNuevo(msgEl, { onCancelar, onGuardarBorrador, onGuardarNuevo }) {
  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";

  const cancelBtn = buildFootBtn("Cancelar", "ghost");
  cancelBtn.addEventListener("click", onCancelar);
  const draftBtn = buildFootBtn("Borrador", "ghost");
  draftBtn.addEventListener("click", () => onGuardarBorrador(draftBtn));
  const saveBtn = buildFootBtn("Guardar", "primary");
  saveBtn.addEventListener("click", () => onGuardarNuevo(saveBtn));

  foot.append(cancelBtn, draftBtn, saveBtn);
  return foot;
}

// Si el alumno ya está archivado (activo:false), en vez del botón único
// "Archivar" se muestran "Restaurar" (benigno, sin confirmación) y
// "Eliminar definitivamente" (irreversible, confirmación vía onEliminarDefinitivo
// — usa window.confirm, ver alumnoDrawer.js). Alumno activo: comportamiento
// sin cambios (Archivar con confirmación inline, ver buildArchivarConfirm).
export function buildFootEditar(msgEl, params) {
  const { alumnoActual, onCancelar, onGuardar, onArchivar, onRestaurar, onEliminarDefinitivo } = params;
  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";
  const estaArchivado = alumnoActual?.activo === false;

  const cancelBtn = buildFootBtn("Cancelar", "ghost");
  cancelBtn.addEventListener("click", onCancelar);
  const saveBtn = buildFootBtn("Guardar", "primary");
  saveBtn.addEventListener("click", () => onGuardar(saveBtn));

  if (estaArchivado) {
    const restaurarBtn = buildFootBtn("Restaurar", "ghost");
    restaurarBtn.addEventListener("click", () => onRestaurar(restaurarBtn));
    const eliminarBtn = buildFootBtn("Eliminar definitivamente", "danger");
    eliminarBtn.addEventListener("click", () => onEliminarDefinitivo(eliminarBtn));
    const right = document.createElement("div");
    right.className = "ac-drawer-foot-right";
    right.append(restaurarBtn, eliminarBtn);
    foot.append(cancelBtn, right, saveBtn);
    return foot;
  }

  const archivarBtn = buildFootBtn("Archivar", "danger");
  archivarBtn.addEventListener("click", () => {
    const confirmFoot = buildArchivarConfirm(alumnoActual.nombre, {
      onCancelar: () => foot.replaceWith(buildFootEditar(msgEl, params)),
      onConfirmar: onArchivar,
    });
    foot.replaceWith(confirmFoot);
  });
  foot.append(cancelBtn, archivarBtn, saveBtn);
  return foot;
}
