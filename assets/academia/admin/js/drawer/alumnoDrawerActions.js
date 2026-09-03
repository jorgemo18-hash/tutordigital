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
  // `exigirFamilia`: lo que obliga a tener familia es el ESTADO ACTIVO, no
  // el botón que se pulse. Un borrador es "lo que sé por ahora" —
  // normalmente una madre que escribe diciendo que su hija empieza y qué
  // días puede: hay nombre, curso y horario, y la familia y el email
  // llegan con la ficha, días después. Bloquear ese guardado obliga a
  // inventarse una familia vacía o a apuntarlo en un papel, que es justo lo
  // que la app viene a quitar. Al pasar a alumno activo se exige todo.
  function recogerPayloadComun(msgEl, { exigirFamilia = true } = {}) {
    const sections = getSections();
    const datos = sections.datos.getValue();
    if (!datos.nombre || !datos.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return null;
    }
    const tarifa = sections.tarifa.getValue();
    const familiaValue = sections.familia.getValue();
    if (exigirFamilia && !familiaValue.familia_id) {
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

  // Guarda TODO lo que ya se sepa —contacto, familia si la hay, tarifa,
  // horario— sin exigir nada más que nombre y curso. Queda activo:false y
  // sin fecha_baja, es decir en la pestaña "Borradores", hasta que el admin
  // lo complete (ver server/lib/academiaAlumnos/estado.js).
  //
  // Antes solo mandaba `datos`: el horario que el admin acababa de marcar
  // se perdía al guardar como borrador, y es justo el dato que suele
  // llegar primero ("empieza en octubre, martes y jueves"). Tener que
  // volver a marcarlo después es lo que hace que un borrador no se use.
  async function guardarBorrador(msgEl, draftBtn) {
    const datos = recogerPayloadComun(msgEl, { exigirFamilia: false });
    if (!datos) return;
    datos.activo = false;
    datos.horario = getSections().horario.getValue();
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
    const alumnoActual = getAlumnoActual();
    // Un borrador sigue siendo un borrador al guardarlo: se le van añadiendo
    // datos según llegan, y exigirle familia para poder guardar el horario
    // que acaba de decir la madre no tiene ningún sentido. La exigencia
    // vuelve en cuanto se le da de alta de verdad ("Restaurar" en el pie del
    // drawer, que es lo que lo pasa a activo).
    const esBorrador = alumnoActual?.activo === false;
    const payload = recogerPayloadComun(msgEl, { exigirFamilia: !esBorrador });
    if (!payload) return;
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

  // El borrador se convierte en alumno de verdad: guarda lo que haya en
  // pantalla Y lo activa, en una sola acción. Aquí SÍ se exige todo
  // (familia, y email si el centro reparte el tutor) porque es el momento
  // en el que la exigencia tiene sentido: de aquí salen recibos e informes.
  //
  // Guarda antes de activar a propósito: si el admin acaba de rellenar la
  // familia y la tarifa, activar sin guardar dejaría al alumno activo con
  // los datos viejos, que es peor que no activarlo.
  async function darDeAlta(msgEl, btn) {
    const alumnoActual = getAlumnoActual();
    const payload = recogerPayloadComun(msgEl, { exigirFamilia: true });
    if (!payload) return;
    if (accesoTutorActivo && !payload.email) {
      showMsg(msgEl, "El email del alumno es obligatorio para poder invitarle al tutor");
      return;
    }
    btn.disabled = true;
    try {
      await updateAlumno(alumnoActual.id, payload);
      await updateHorarioAlumno(alumnoActual.id, getSections().horario.getValue());
      await restaurarAlumno(alumnoActual.id);
      onSaved(null);
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo dar de alta al alumno.");
      btn.disabled = false;
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

  return { guardarNuevo, guardarBorrador, guardarCambios, darDeAlta, archivar, restaurar, eliminarDefinitivo };
}
