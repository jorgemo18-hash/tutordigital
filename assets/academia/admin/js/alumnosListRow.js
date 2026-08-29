// Fila individual de la lista de alumnos — extraído de alumnosList.js para
// no superar las 400 líneas al añadir el acceso directo a "Restaurar" en
// la pestaña Archivados. Solo construye DOM; todo lo demás (fetch, estado
// de tabs/paginación) sigue en alumnosList.js y llega aquí como callbacks.
import { nivelInfo } from "./curso.js";
import { buildIcon } from "./icons.js";

export function initials(nombre) {
  const palabras = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return "—";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

export function formatPrecio(alumno) {
  const precio = alumno.tarifa_vigente?.precio_neto;
  if (precio == null) return "";
  return `${Number(precio).toFixed(2)} €/mes`;
}

// Indicador no bloqueante de "faltan datos" (horario y/o tarifa) — solo se
// muestra en Activos (borrador/archivado tienen sus propias prioridades).
// No bloquea guardado ni listado, ver informe de validación de alta de alumno.
function buildAvisoDatosIncompletos(alumno) {
  const faltantes = [];
  if (!alumno.tiene_horario) faltantes.push("horario");
  if (alumno.tarifa_vigente == null) faltantes.push("tarifa");
  if (!faltantes.length) return null;
  const icon = buildIcon("alertTriangle", { size: 13 });
  icon.classList.add("ac-list-aviso-incompleto");
  const texto = `Datos incompletos: falta ${faltantes.join(" y ")}`;
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", texto);
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = texto;
  icon.appendChild(title);
  return icon;
}

// Confirmación inline compartida por Archivar y Eliminar definitivamente —
// mismo mecanismo exacto, solo cambia el mensaje/etiqueta/acción.
function buildRowConfirm({ mensaje, confirmLabel, errorFallback, onConfirmarFn, alumno, row, onArchivado }) {
  const confirm = document.createElement("div");
  confirm.className = "ac-list-confirm";
  const texto = document.createElement("span");
  texto.textContent = mensaje;
  const actions = document.createElement("div");
  actions.className = "ac-list-confirm-actions";

  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.className = "ac-btn ghost sm";
  noBtn.textContent = "No";
  noBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    row.classList.remove("ac-list-row--confirming");
    confirm.remove();
  });

  const siBtn = document.createElement("button");
  siBtn.type = "button";
  siBtn.className = "ac-btn danger sm";
  siBtn.textContent = confirmLabel;
  siBtn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    siBtn.disabled = true;
    try {
      await onConfirmarFn(alumno.id);
      onArchivado();
    } catch (err) {
      confirm.classList.add("error");
      texto.textContent = err.message || errorFallback;
      siBtn.disabled = false;
    }
  });

  actions.append(noBtn, siBtn);
  confirm.append(texto, actions);
  return confirm;
}

export function buildArchiveConfirm(alumno, row, { onArchivarFn, onArchivado }) {
  return buildRowConfirm({
    mensaje: `¿Archivar a ${alumno.nombre}?`,
    confirmLabel: "Sí, archivar",
    errorFallback: "No se pudo archivar el alumno.",
    onConfirmarFn: onArchivarFn,
    alumno, row, onArchivado,
  });
}

function buildEliminarDefinitivoConfirm(alumno, row, { onEliminarFn, onArchivado }) {
  return buildRowConfirm({
    mensaje: `¿Eliminar definitivamente a ${alumno.nombre}? Esta acción no se puede deshacer.`,
    confirmLabel: "Sí, eliminar",
    errorFallback: "No se pudo eliminar el alumno.",
    onConfirmarFn: onEliminarFn,
    alumno, row, onArchivado,
  });
}

// Restaurar es benigno (mismo criterio que en el drawer, ver
// drawer/alumnoDrawerFoot.js) — un solo clic, sin confirmación previa.
function buildRestoreButton(alumno, { onRestaurarFn, onArchivado }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-list-restore-btn";
  btn.title = "Restaurar alumno";
  btn.textContent = "Restaurar";
  btn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    btn.disabled = true;
    try {
      await onRestaurarFn(alumno.id);
      onArchivado();
    } catch (err) {
      window.alert(err.message || "No se pudo restaurar el alumno.");
      btn.disabled = false;
    }
  });
  return btn;
}

// Restaurar + Eliminar definitivamente juntos en la misma celda del grid
// (ver .ac-list-row-acciones) — eliminar sí pide confirmación inline,
// mismo mecanismo exacto que buildArchiveConfirm.
function buildAccionesArchivado(alumno, row, { onRestaurarFn, onEliminarFn, onArchivado }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-row-acciones";
  wrap.appendChild(buildRestoreButton(alumno, { onRestaurarFn, onArchivado }));

  const eliminarBtn = document.createElement("button");
  eliminarBtn.type = "button";
  eliminarBtn.className = "ac-list-archive-btn";
  eliminarBtn.title = "Eliminar definitivamente";
  eliminarBtn.appendChild(buildIcon("trash", { size: 13 }));
  eliminarBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (row.classList.contains("ac-list-row--confirming")) return;
    row.classList.add("ac-list-row--confirming");
    row.appendChild(buildEliminarDefinitivoConfirm(alumno, row, { onEliminarFn, onArchivado }));
  });
  wrap.appendChild(eliminarBtn);

  return wrap;
}

export function buildRow(alumno, onAbrir, {
  borrador = false, archivado = false, onArchivarFn, onRestaurarFn, onEliminarFn, onArchivado,
} = {}) {
  const row = document.createElement("div");
  row.className = "ac-list-row";
  row.addEventListener("click", () => onAbrir(alumno));

  const avatar = document.createElement("div");
  avatar.className = "ac-list-avatar";
  avatar.textContent = initials(alumno.nombre);
  row.appendChild(avatar);

  const id = document.createElement("div");
  id.className = "ac-list-row-id";
  const nameRow = document.createElement("div");
  nameRow.className = "ac-list-row-left";
  const name = document.createElement("span");
  name.className = "ac-list-name";
  name.textContent = alumno.nombre || "(sin nombre)";
  const sep = document.createElement("span");
  sep.className = "ac-list-sep";
  sep.textContent = "·";
  const curso = document.createElement("span");
  curso.className = "ac-list-curso";
  curso.textContent = alumno.curso || "";
  nameRow.append(name, sep, curso);
  const lvTag = document.createElement("span");
  if (borrador) {
    // Un borrador es una ficha guardada a medias, no un alumno "pendiente"
    // de algo: nunca ha llegado a estar de alta. La pestaña se llama
    // Borradores y el badge tiene que decir lo mismo.
    lvTag.className = "ac-lv borrador";
    lvTag.textContent = "BORRADOR";
  } else {
    const lv = nivelInfo(alumno.nivel);
    lvTag.className = `ac-lv ${lv.cls}`;
    lvTag.textContent = lv.label;
  }
  nameRow.appendChild(lvTag);
  if (!borrador && !archivado) {
    const aviso = buildAvisoDatosIncompletos(alumno);
    if (aviso) nameRow.appendChild(aviso);
  }
  id.appendChild(nameRow);
  row.appendChild(id);

  const familia = document.createElement("div");
  familia.className = "ac-list-familia";
  if (alumno.familia?.nombre) {
    const tutor = document.createElement("span");
    tutor.className = "ac-list-familia-nombre";
    tutor.textContent = alumno.familia.nombre;
    familia.appendChild(tutor);
  }
  if (alumno.familia?.email) {
    const email = document.createElement("span");
    email.className = "ac-list-email";
    email.textContent = alumno.familia.email;
    familia.appendChild(email);
  }
  row.appendChild(familia);

  const precio = document.createElement("span");
  precio.className = "ac-list-precio";
  precio.textContent = formatPrecio(alumno);
  row.appendChild(precio);

  if (archivado && onRestaurarFn) {
    row.appendChild(buildAccionesArchivado(alumno, row, { onRestaurarFn, onEliminarFn, onArchivado }));
  } else if (onArchivarFn) {
    const archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.className = "ac-list-archive-btn";
    archiveBtn.title = "Archivar alumno";
    archiveBtn.appendChild(buildIcon("archive", { size: 13 }));
    archiveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (row.classList.contains("ac-list-row--confirming")) return;
      row.classList.add("ac-list-row--confirming");
      row.appendChild(buildArchiveConfirm(alumno, row, { onArchivarFn, onArchivado }));
    });
    row.appendChild(archiveBtn);
  }

  return row;
}
