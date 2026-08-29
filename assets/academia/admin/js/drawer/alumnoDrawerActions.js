// alumnoDrawerActions.js — todas las acciones de persistencia del drawer
// de alumno (crear/guardar/archivar/restaurar/eliminar) — extraídas de
// alumnoDrawer.js para dejarle margen real bajo las 400 líneas, no solo
// para cumplir el número. getSections/getAlumnoActual como getters (no
// los valores directos) porque ambos cambian entre aperturas del mismo
// drawer — dependencias explícitas, nunca cerrando sobre el scope del
// padre.
import {
  createAlumno, updateAlumno, updateHorarioAlumno, archivarAlumno, restaurarAlumno,
  eliminarAlumnoDefinitivo, updateDescuentosAlumno, uploadFichaAlumno,
} from "../api.js";
import { formatAvisoArchivoFamilia } from "./avisoArchivoFamilia.js";
import { showToast } from "../toast.js";

function showMsg(msgEl, text, type = "error") {
  msgEl.textContent = text;
  msgEl.className = `ac-drawer-msg ${type}`;
}

export function createAlumnoDrawerActions({
  getSections, getAlumnoActual, onSaved, close, accesoTutorActivo = false,
  // La ficha en papel llega del control de subida (alta nueva) y se adjunta
  // tras crear al alumno. Ambas inyectables para poder probar ese orden:
  // subir antes de que el alumno exista es exactamente el error que dejó
  // archivos huérfanos en Storage en el flujo de gastos.
  getFichaArchivo = () => null,
  uploadFichaAlumnoFn = uploadFichaAlumno,
  createAlumnoFn = createAlumno,
}) {
  // Los campos de contacto (email/teléfono/dirección/ciudad/CP) viajan
  // dentro de `datos` y se guardan directos en academia_alumnos — ya no
  // dependen de tener una familia vinculada (ver migración 061).
  function recogerPayloadComun(msgEl) {
    const sections = getSections();
    const datos = sections.datos.getValue();
    if (!datos.nombre || !datos.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return null;
    }
    const tarifa = sections.tarifa.getValue();
    const familiaValue = sections.familia.getValue();
    if (!familiaValue.familia_id) {
      sections.familia.showError("Es obligatorio asignar una familia");
      sections.familia.wrap.scrollIntoView({ behavior: "smooth", block: "start" });
      return null;
    }
    return { ...datos, ...familiaValue, tarifa };
  }

  // El alumno se crea primero (necesita su id) y, si hay algo seleccionado
  // en "DESCUENTOS RECURRENTES" (modo alumno nuevo, ver
  // descuentosRecurrentesSection.js#buildDescuentosNuevoAlumno), se aplica
  // justo después con ese id — una sola acción desde el punto de vista del
  // admin. Si esto falla, el alumno ya quedó creado igual: se ignora en
  // silencio porque siempre puede asignarlos después desde su ficha (el
  // toast de éxito en alumnosSection.js ya lo indica).
  async function aplicarDescuentosNuevoAlumno(alumnoId) {
    const seleccionados = getSections().descuentosNuevo?.getSeleccionados() || [];
    if (!seleccionados.length) return;
    try {
      await updateDescuentosAlumno(alumnoId, seleccionados);
    } catch {
      // silencioso a propósito, ver comentario de la función.
    }
  }

  // La foto de la ficha en papel se adjunta DESPUÉS de crear al alumno,
  // contra su id real. Nunca antes con un id inventado: eso es lo que dejó
  // archivos huérfanos en Storage en el flujo de gastos, bajo un id que no
  // corresponde a ninguna fila.
  //
  // No bloquea el alta: si la subida falla, el alumno ya está creado y
  // correcto — se avisa y la ficha se puede subir luego desde su propia
  // pantalla (buildFichaBlock). Perder el alta por no poder guardar una
  // imagen sería el peor intercambio posible.
  async function adjuntarFicha(alumnoId) {
    const archivo = getFichaArchivo();
    if (!archivo) return null;
    try {
      await uploadFichaAlumnoFn(alumnoId, archivo);
      return null;
    } catch {
      return "Alumno guardado, pero no se pudo adjuntar la ficha. Ábrelo y súbela de nuevo.";
    }
  }

  async function guardarNuevo(msgEl, saveBtn) {
    const payload = recogerPayloadComun(msgEl);
    if (!payload) return;
    // Solo en el alta completa (activo:true) — "Borrador" (guardarBorrador,
    // más abajo) no pasa por aquí y sigue sin exigir email, se completa
    // después. Y solo si el centro ha repartido el tutor: si no, no hay
    // ningún acceso que enviar y exigir el email obligaría a inventarse uno
    // para poder guardar la ficha. Mismo criterio que buildAlumnoCreateSchema
    // en el backend (ver migración 105).
    if (accesoTutorActivo && !payload.email) {
      showMsg(msgEl, "El email del alumno es obligatorio para poder invitarle al tutor");
      return;
    }
    payload.horario = getSections().horario.getValue();
    saveBtn.disabled = true;
    try {
      const result = await createAlumnoFn(payload);
      const alumno = result.alumno;
      await aplicarDescuentosNuevoAlumno(alumno.id);
      const avisoFicha = await adjuntarFicha(alumno.id);
      onSaved(alumno, { esNuevo: true, accesoWarning: result.acceso_warning });
      close();
      if (avisoFicha) showToast(avisoFicha, { duracionMs: 9000 });
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo crear el alumno.");
      saveBtn.disabled = false;
    }
  }

  // Guarda solo nombre+curso+contacto, sin familia/horario/tarifa, como
  // pendiente de completar — por eso siempre queda activo:false y sin
  // fecha_baja (aparece en la pestaña "Borradores" hasta que el admin lo
  // revise y lo guarde del todo, ver server/lib/academiaAlumnos/estado.js).
  async function guardarBorrador(msgEl, draftBtn) {
    const datos = getSections().datos.getValue();
    if (!datos.nombre || !datos.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return;
    }
    datos.activo = false;
    draftBtn.disabled = true;
    try {
      const result = await createAlumnoFn(datos);
      const alumno = result.alumno;
      await aplicarDescuentosNuevoAlumno(alumno.id);
      // También en borrador: es justo el caso en que la ficha en papel es lo
      // único fiable que hay todavía (falta horario, tarifa, familia...).
      const avisoFicha = await adjuntarFicha(alumno.id);
      onSaved(alumno, { esNuevo: true, accesoWarning: result.acceso_warning });
      close();
      if (avisoFicha) showToast(avisoFicha, { duracionMs: 9000 });
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo guardar el borrador.");
      draftBtn.disabled = false;
    }
  }

  async function guardarCambios(msgEl, saveBtn) {
    const payload = recogerPayloadComun(msgEl);
    if (!payload) return;
    const alumnoActual = getAlumnoActual();
    saveBtn.disabled = true;
    try {
      const alumno = await updateAlumno(alumnoActual.id, payload);
      await updateHorarioAlumno(alumnoActual.id, getSections().horario.getValue());
      onSaved(alumno);
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo guardar el alumno.");
      saveBtn.disabled = false;
    }
  }

  async function archivar(msgEl) {
    const alumnoActual = getAlumnoActual();
    try {
      const result = await archivarAlumno(alumnoActual.id);
      onSaved(null);
      close();
      // No bloqueante y a propósito: el drawer ya se cerró, el archivado ya
      // se aplicó — esto es solo un recordatorio, nunca revierte ni condiciona
      // el archivado en sí (ver avisoArchivoFamilia.js).
      const aviso = formatAvisoArchivoFamilia(result?.hermanosConDescuento);
      if (aviso) showToast(aviso, { duracionMs: 9000 });
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo archivar el alumno.");
    }
  }

  async function restaurar(msgEl, btn) {
    const alumnoActual = getAlumnoActual();
    btn.disabled = true;
    try {
      await restaurarAlumno(alumnoActual.id);
      onSaved(null);
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo restaurar el alumno.");
      btn.disabled = false;
    }
  }

  // "Eliminar definitivamente" solo se muestra para un alumno ya archivado
  // (ver alumnoDrawerFoot.js) — irreversible, por eso confirm() antes de
  // llamar al backend (que también rechaza el borrado si no está archivado).
  async function eliminarDefinitivo(msgEl, btn) {
    const alumnoActual = getAlumnoActual();
    if (!window.confirm(`¿Eliminar definitivamente a ${alumnoActual.nombre}? Esta acción no se puede deshacer.`)) return;
    btn.disabled = true;
    try {
      await eliminarAlumnoDefinitivo(alumnoActual.id);
      onSaved(null);
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo eliminar el alumno.");
      btn.disabled = false;
    }
  }

  return { guardarNuevo, guardarBorrador, guardarCambios, archivar, restaurar, eliminarDefinitivo };
}
