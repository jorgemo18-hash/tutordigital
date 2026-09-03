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
// Cancelar queda a la izquierda y Guardar a la derecha por el propio orden
// del append + justify-content:space-between de .ac-drawer-foot. El texto
// de "Guardar" cambia en vivo según haya email o no (ver setTieneEmail,
// llamado desde datosSection.js#onEmailChange en alumnoDrawer.js).
export function buildFootNuevo(msgEl, { onCancelar, onGuardarBorrador, onGuardarNuevo, accesoTutorActivo = false }) {
  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";

  const cancelBtn = buildFootBtn("Cancelar", "ghost");
  cancelBtn.addEventListener("click", onCancelar);
  const draftBtn = buildFootBtn("Borrador", "ghost");
  draftBtn.addEventListener("click", () => onGuardarBorrador(draftBtn));
  const saveBtn = buildFootBtn("Guardar", "primary");
  saveBtn.addEventListener("click", () => onGuardarNuevo(saveBtn));

  foot.append(cancelBtn, draftBtn, saveBtn);
  return {
    el: foot,
    setTieneEmail(tieneEmail) {
      // Con el tutor apagado, guardar no envía nada: el botón no debe
      // prometer un acceso que no se manda (ver migración 105).
      saveBtn.textContent = accesoTutorActivo && tieneEmail ? "Guardar y enviar acceso" : "Guardar";
    },
  };
}

// Si el alumno ya está archivado (activo:false), en vez del botón único
// "Archivar" se muestran "Restaurar" (benigno, sin confirmación) y
// "Eliminar definitivamente" (irreversible, confirmación vía onEliminarDefinitivo
// — usa window.confirm, ver alumnoDrawer.js). Alumno activo: comportamiento
// sin cambios (Archivar con confirmación inline, ver buildArchivarConfirm).
export function buildFootEditar(msgEl, params) {
  const {
    alumnoActual, onCancelar, onGuardar, onArchivar, onRestaurar,
    onEliminarDefinitivo, onDarDeAlta,
  } = params;
  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";
  // BORRADOR y ARCHIVADO son los dos `activo:false`, y no son lo mismo (ver
  // server/lib/academiaAlumnos/estado.js): el borrador es un alumno que
  // todavía no ha empezado y el archivado uno que se fue. El pie los
  // trataba igual, así que a un borrador le ofrecía "Restaurar" y
  // "Eliminar definitivamente" — dos palabras que no dicen nada de lo que
  // de verdad toca hacer ahí, que es acabar de rellenarlo y darlo de alta.
  const estaArchivado = alumnoActual?.activo === false && !!alumnoActual?.fecha_baja;
  const esBorrador = alumnoActual?.activo === false && !alumnoActual?.fecha_baja;

  const cancelBtn = buildFootBtn("Cancelar", "ghost");
  cancelBtn.addEventListener("click", onCancelar);
  const saveBtn = buildFootBtn(esBorrador ? "Guardar borrador" : "Guardar", "primary");
  saveBtn.addEventListener("click", () => onGuardar(saveBtn));

  if (esBorrador) {
    // "Guardar borrador" no exige nada más que nombre y curso; "Dar de
    // alta" sí lo exige todo, porque es lo que convierte esto en un alumno
    // del que salen recibos e informes.
    const altaBtn = buildFootBtn("Dar de alta", "ghost");
    altaBtn.addEventListener("click", () => onDarDeAlta(altaBtn));
    foot.append(cancelBtn, altaBtn, saveBtn);
    return foot;
  }

  if (estaArchivado) {
    // 2 filas: Restaurar/Cancelar/Guardar arriba, "Eliminar definitivamente"
    // sola abajo a ancho completo — para que destaque como la acción
    // peligrosa que es, separada de las benignas (ver .ac-btn--block).
    foot.classList.add("ac-drawer-foot--stacked");

    const restaurarBtn = buildFootBtn("Restaurar", "ghost");
    restaurarBtn.addEventListener("click", () => onRestaurar(restaurarBtn));
    const filaSuperior = document.createElement("div");
    filaSuperior.className = "ac-drawer-foot-row";
    filaSuperior.append(restaurarBtn, cancelBtn, saveBtn);

    const eliminarBtn = buildFootBtn("Eliminar definitivamente", "danger");
    eliminarBtn.classList.add("ac-btn--block");
    eliminarBtn.addEventListener("click", () => onEliminarDefinitivo(eliminarBtn));
    const filaEliminar = document.createElement("div");
    filaEliminar.className = "ac-drawer-foot-row";
    filaEliminar.appendChild(eliminarBtn);

    foot.append(filaSuperior, filaEliminar);
    return foot;
  }

  const archivarBtn = buildFootBtn("Archivar", "danger");
  archivarBtn.addEventListener("click", () => {
    // El "No" tiene que sustituir a la CONFIRMACIÓN, no a `foot`: para
    // cuando se pulsa, `foot` ya está fuera del DOM y replaceWith sobre un
    // nodo sin padre no hace nada — en silencio. El resultado era que "No"
    // no cancelaba: la confirmación se quedaba pegada y la única salida era
    // cerrar el drawer.
    let confirmFoot;
    confirmFoot = buildArchivarConfirm(alumnoActual.nombre, {
      onCancelar: () => confirmFoot.replaceWith(buildFootEditar(msgEl, params)),
      onConfirmar: onArchivar,
    });
    foot.replaceWith(confirmFoot);
  });
  foot.append(cancelBtn, archivarBtn, saveBtn);
  return foot;
}
