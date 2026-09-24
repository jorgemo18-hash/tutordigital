import { el, boton, campo } from "../elementos.js";
import { siguienteDiaLectivo } from "./ponerComoDeberes.js";

// EL DIÁLOGO DE "PONER COMO DEBERES": grupo, entrega, título y una nota
// para el alumno. Mismo aspecto que "Cambiar este ejercicio" (rc-modal; en
// el móvil, hoja inferior). No llama a la API: `onEnviar(datos)` hace el
// trabajo y devuelve { tarea, adjunto, error }; `onReintentar(tarea)` vuelve
// a adjuntar el PDF si falló.
//
// Un profesor sin grupos no puede poner deberes: se dice, sin formulario.
function opcionesDeGrupo(doc, grupos, activo) {
  const s = el(doc, "select", "rc-sel");
  for (const g of grupos) {
    const o = el(doc, "option", "", g.name || "Grupo");
    o.value = g.id;
    s.appendChild(o);
  }
  if (grupos.some((g) => g.id === activo)) s.value = activo;
  return s;
}

export function abrirDialogoDeDeberes({
  codigo, tituloSugerido, grupos, grupoActivo, onEnviar, onReintentar, onCerrar = () => {},
  hoy = new Date(), doc = document,
}) {
  const ovl = el(doc, "div", "rc rc-ovl");
  const modal = el(doc, "div", "rc-modal rc-deberes");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Poner como deberes");
  const mh = el(doc, "div", "rc-modal__h");
  mh.append(el(doc, "div", "rc-crumb", `Hoja ${codigo}`), el(doc, "h2", "", "Poner como deberes"),
    el(doc, "div", "rc-sub", "El grupo la verá en su agenda, con el PDF de la hoja."));
  const mb = el(doc, "div", "rc-modal__b rc-deberes__b");
  const aviso = el(doc, "p", "rc-modal__aviso");
  aviso.hidden = true;
  const cancelar = boton(doc, "Cancelar", { onClick: () => cerrar() });
  const aceptar = boton(doc, "Poner como deberes", { clase: "rc-btn--pri" });
  const mf = el(doc, "div", "rc-modal__f");
  mf.append(aviso, el(doc, "span", "rc-sp"), cancelar, aceptar);
  modal.append(mh, mb, mf);
  ovl.appendChild(modal);

  const mostrarAviso = (t) => { aviso.textContent = t || ""; aviso.hidden = !t; };
  function cerrar() {
    ovl.remove();
    doc.removeEventListener("keydown", alTeclado);
    onCerrar();
  }
  function alTeclado(e) { if (e.key === "Escape" && !aceptar.disabled) cerrar(); }
  doc.addEventListener("keydown", alTeclado);
  ovl.addEventListener("click", (e) => { if (e.target === ovl && !aceptar.disabled) cerrar(); });

  if (!grupos.length) {
    mb.appendChild(el(doc, "p", "rc-msg", "No tienes grupos asignados: pide a la dirección del centro que te asigne los tuyos."));
    aceptar.hidden = true;
    cancelar.textContent = "Cerrar";
    doc.body.appendChild(ovl);
    return { cerrar, el: ovl };
  }

  const grupo = opcionesDeGrupo(doc, grupos, grupoActivo);
  const entrega = el(doc, "input", "rc-sel rc-deberes__fecha");
  entrega.type = "date";
  entrega.value = siguienteDiaLectivo(hoy);
  const titulo = el(doc, "input", "rc-sel rc-deberes__texto");
  titulo.maxLength = 120;
  titulo.value = tituloSugerido;
  const nota = el(doc, "textarea", "rc-ta");
  nota.rows = 2;
  nota.maxLength = 2000;
  nota.placeholder = "Opcional. Por ejemplo: haced solo del 1 al 4";
  const fila = el(doc, "div", "rc-deberes__fila");
  fila.append(campo(doc, "Grupo", grupo), campo(doc, "Entrega", entrega));
  mb.append(fila, campo(doc, "Título", titulo), campo(doc, "Nota para el alumno", nota));

  let creada = null; // si la tarea se creó pero el PDF no, reintentar solo el PDF
  function ocupado(si, texto) {
    for (const c of [aceptar, cancelar, grupo, entrega, titulo, nota]) c.disabled = si;
    aceptar.textContent = si ? texto : (creada ? "Adjuntar el PDF otra vez" : "Poner como deberes");
    aceptar.classList.toggle("is-cargando", si);
  }

  async function confirmar() {
    mostrarAviso("");
    if (creada) {
      ocupado(true, "Adjuntando el PDF…");
      try {
        await onReintentar(creada);
        cerrar();
      } catch (err) {
        mostrarAviso(`La tarea ya está creada, pero el PDF no se pudo adjuntar: ${err?.message || "error"}.`);
        ocupado(false);
      }
      return;
    }
    if (!titulo.value.trim()) { mostrarAviso("Ponle un título."); titulo.focus(); return; }
    if (!entrega.value) { mostrarAviso("Elige el día de entrega."); entrega.focus(); return; }
    ocupado(true, "Poniendo los deberes…");
    try {
      const r = await onEnviar({ grupoId: grupo.value, entrega: entrega.value, titulo: titulo.value, nota: nota.value });
      if (r.adjunto) { cerrar(); return; }
      creada = r.tarea;
      mostrarAviso(`La tarea está creada, pero el PDF no se pudo adjuntar: ${r.error}. Vuelve a intentarlo.`);
    } catch (err) {
      mostrarAviso(err?.message || "No se pudieron poner los deberes.");
    }
    ocupado(false);
  }
  aceptar.addEventListener("click", confirmar);

  doc.body.appendChild(ovl);
  grupo.focus(); // no el título: en el móvil abriría el teclado y taparía la hoja
  return { cerrar, el: ovl };
}
