import { buildDatosSection } from "./datosSection.js";
import { buildFamiliaSection } from "./familiaSection.js";
import { buildHorarioSection } from "./horarioSection.js";
import { buildTarifaSection } from "./tarifaSection.js";
import { buildDescuentosRecurrentesSection, buildDescuentosNuevoAlumno } from "./descuentosRecurrentesSection.js";
import { buildEconomicoFamiliaSection } from "./economicoFamiliaSection.js";
import { buildInscripcionUpload } from "./inscripcionUpload.js";
import { createHistorialDrawer } from "./historial/historialDrawer.js";
import { createSelectorFamiliaDrawer } from "./familia/selectorFamiliaDrawer.js";
import {
  createAlumno, updateAlumno, updateHorarioAlumno, archivarAlumno, restaurarAlumno,
  eliminarAlumnoDefinitivo, updateDescuentosAlumno,
} from "../api.js";
import { buildFootNuevo, buildFootEditar } from "./alumnoDrawerFoot.js";
import { buildIcon } from "../icons.js";
import { formatAvisoArchivoFamilia } from "./avisoArchivoFamilia.js";
import { showToast } from "../toast.js";

const METODO_PAGO_OCR = { sepa: "domiciliado" };
// El email del OCR va también a la familia (el contacto de facturación del
// tutor) — el resto de datos extraídos (teléfono/dirección/ciudad/CP) son
// propios del alumno y van directos a "Datos del alumno" (ver onExtraido).
const FAMILIA_OCR_KEYS = ["email"];

function buildHead(titulo, onClose) {
  const head = document.createElement("div");
  head.className = "ac-drawer-head";
  const title = document.createElement("div");
  title.className = "ac-drawer-title";
  title.textContent = titulo;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "ac-drawer-close";
  closeBtn.appendChild(buildIcon("close", { size: 14 }));
  closeBtn.addEventListener("click", onClose);
  head.append(title, closeBtn);
  return head;
}

// Combina lo que el admin ya haya escrito en la sección familia con los
// campos que el OCR sí extrajo — un campo vacío en el OCR no borra lo que
// ya hubiera en el formulario.
function aplicarOcrAFamilia(familiaSection, datosOcr) {
  const actual = familiaSection.getValue().familia_nueva || {};
  const merged = { ...actual };
  for (const key of FAMILIA_OCR_KEYS) {
    if (datosOcr[key]) merged[key] = datosOcr[key];
  }
  if (datosOcr.metodo_pago) {
    merged.metodo_pago = METODO_PAGO_OCR[datosOcr.metodo_pago] || datosOcr.metodo_pago;
  }
  familiaSection.prefillNueva(merged);
}

function buildMsg() {
  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";
  return msg;
}

function showMsg(msgEl, text, type = "error") {
  msgEl.textContent = text;
  msgEl.className = `ac-drawer-msg ${type}`;
}

export function createAlumnoDrawer(root, { config, onSaved }) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  // Drawers anidados, creados una sola vez y reutilizados — igual que el
  // de alumno (ver historial/historialDrawer.js y
  // familia/selectorFamiliaDrawer.js). Crearlos aquí, no dentro de
  // buildFamiliaSection()/render(), evita apilar overlays huérfanos en el
  // DOM cada vez que se abre el drawer de alumno. `onCerrarTodo` se pasa
  // explícito hasta el nivel más profundo de cada uno para que un clic
  // fuera de cualquier overlay anidado cierre todo de golpe, sin que cada
  // nivel tenga que conocer a sus ancestros.
  const historialDrawer = createHistorialDrawer(root, { config, onCerrarTodo: close });
  const selectorFamiliaDrawer = createSelectorFamiliaDrawer(root, { onCerrarTodo: close });

  let alumnoActual = null;
  let sections = {};

  // Cierra este drawer y, en cascada, los dos anidados (y el recibo dentro
  // del historial, si estaba abierto) — pero nunca al revés: cerrar un
  // nivel hijo no afecta a sus ancestros (ver docs/drawer-stacking.md).
  function close() {
    overlay.classList.remove("open");
    historialDrawer.close();
    selectorFamiliaDrawer.close();
  }

  // Los campos de contacto (email/teléfono/dirección/ciudad/CP) viajan
  // dentro de `datos` y se guardan directos en academia_alumnos — ya no
  // dependen de tener una familia vinculada (ver migración 061).
  function recogerPayloadComun(msgEl) {
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
    const seleccionados = sections.descuentosNuevo?.getSeleccionados() || [];
    if (!seleccionados.length) return;
    try {
      await updateDescuentosAlumno(alumnoId, seleccionados);
    } catch {
      // silencioso a propósito, ver comentario de la función.
    }
  }

  async function guardarNuevo(msgEl, saveBtn) {
    const payload = recogerPayloadComun(msgEl);
    if (!payload) return;
    // Solo en el alta completa (activo:true) — "Borrador" (guardarBorrador,
    // más abajo) no pasa por aquí y sigue sin exigir email, se completa
    // después. Mismo criterio que el refine de AlumnoCreateSchema en el backend.
    if (!payload.email) {
      showMsg(msgEl, "El email del alumno es obligatorio para poder invitarle al tutor");
      return;
    }
    payload.horario = sections.horario.getValue();
    saveBtn.disabled = true;
    try {
      const result = await createAlumno(payload);
      const alumno = result.alumno;
      await aplicarDescuentosNuevoAlumno(alumno.id);
      onSaved(alumno, { esNuevo: true, accesoWarning: result.acceso_warning });
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo crear el alumno.");
      saveBtn.disabled = false;
    }
  }

  // Guarda solo nombre+curso+contacto, sin familia/horario/tarifa, como
  // pendiente de completar — por eso siempre queda activo:false (aparece
  // en la pestaña "Pendientes" hasta que el admin lo revise y guarde del todo).
  async function guardarBorrador(msgEl, draftBtn) {
    const datos = sections.datos.getValue();
    if (!datos.nombre || !datos.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return;
    }
    datos.activo = false;
    draftBtn.disabled = true;
    try {
      const result = await createAlumno(datos);
      const alumno = result.alumno;
      await aplicarDescuentosNuevoAlumno(alumno.id);
      onSaved(alumno, { esNuevo: true, accesoWarning: result.acceso_warning });
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo guardar el borrador.");
      draftBtn.disabled = false;
    }
  }

  async function guardarCambios(msgEl, saveBtn) {
    const payload = recogerPayloadComun(msgEl);
    if (!payload) return;
    saveBtn.disabled = true;
    try {
      const alumno = await updateAlumno(alumnoActual.id, payload);
      await updateHorarioAlumno(alumnoActual.id, sections.horario.getValue());
      onSaved(alumno);
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo guardar el alumno.");
      saveBtn.disabled = false;
    }
  }

  async function archivar(msgEl) {
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

  function render() {
    drawer.innerHTML = "";
    const esNuevo = !alumnoActual;
    const msgEl = buildMsg();

    sections = {};
    // Asignado más abajo, tras construir el pie — el callback solo se
    // dispara con interacción del usuario (o prefillContacto, disparado
    // por elegir familia), nunca durante esta misma construcción síncrona.
    let footCtl = null;
    // La tarifa se construye antes para que "Familia completa" pueda leer
    // su valor en vivo (getTarifaActual) sin duplicar esos campos.
    sections.tarifa = buildTarifaSection({
      tarifaActual: alumnoActual?.tarifa || null,
      onChange: () => sections.familia?.refreshTotal(),
    });
    sections.familia = buildFamiliaSection({
      familiaActual: alumnoActual?.familia || null,
      esAlumnoExistente: !esNuevo,
      alumnoId: alumnoActual?.id || null,
      selectorFamiliaDrawer,
      getTarifaActual: () => sections.tarifa.getValue(),
      // Al elegir/crear una familia en el segundo drawer, su contacto
      // prerellena "Datos del alumno" (sigue editable después) y, si ya
      // existe el bloque económico (Tarea 3), lo recarga con la familia
      // nueva — sección distinta, mismo cambio de origen.
      onFamiliaCambio: (familia) => {
        sections.datos.prefillContacto(familia || {});
        sections.economicoFamilia?.refresh(familia?.id || null);
      },
    });
    sections.datos = buildDatosSection({
      nombre: alumnoActual?.nombre,
      curso: alumnoActual?.curso,
      fechaAlta: alumnoActual?.fecha_alta,
      email: alumnoActual?.email,
      telefono: alumnoActual?.telefono,
      direccion: alumnoActual?.direccion,
      ciudad: alumnoActual?.ciudad,
      codigoPostal: alumnoActual?.codigo_postal,
      onEmailChange: esNuevo ? (email) => footCtl?.setTieneEmail(!!email) : undefined,
    });
    sections.horario = buildHorarioSection({ config, horarioActual: alumnoActual?.horario || [] });

    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    // FAMILIA va primero: agrupa al alumno bajo un tutor/email/método de
    // pago antes de pedir los datos propios del alumno.
    body.append(sections.familia.wrap, sections.datos.wrap, sections.horario.wrap);
    // Tarifa y descuentos recurrentes van en un mismo grupo visual (menos
    // espacio entre ambas que el resto de secciones, ver
    // .ac-grupo-tarifa-descuentos) porque uno determina el precio neto y el
    // otro lo modifica — están relacionados aunque sean bloques distintos.
    const grupoTarifaDescuentos = document.createElement("div");
    grupoTarifaDescuentos.className = "ac-grupo-tarifa-descuentos";
    grupoTarifaDescuentos.appendChild(sections.tarifa.wrap);
    // Alumno nuevo: las selecciones quedan en memoria hasta crear el
    // alumno (ver aplicarDescuentosNuevoAlumno). Alumno existente: cada
    // checkbox se guarda al instante contra su id ya asignado.
    if (esNuevo) {
      sections.descuentosNuevo = buildDescuentosNuevoAlumno();
      grupoTarifaDescuentos.appendChild(sections.descuentosNuevo.wrap);
    } else {
      sections.descuentos = buildDescuentosRecurrentesSection({ alumnoId: alumnoActual.id });
      grupoTarifaDescuentos.appendChild(sections.descuentos.wrap);
    }
    body.appendChild(grupoTarifaDescuentos);
    // La foto económica familiar, igual que el historial, solo tiene
    // sentido para un alumno que ya existe (necesita una familia ya
    // vinculada de la que leer hermanos/tarifas reales) — para uno nuevo ya
    // cumple ese papel, más simple, el bloque "Familia completa" dentro de
    // la propia sección Familia (ver familiaCompleta.js).
    if (alumnoActual?.id) {
      sections.economicoFamilia = buildEconomicoFamiliaSection({ familiaId: alumnoActual?.familia?.id || null });
      body.appendChild(sections.economicoFamilia.wrap);
    }
    // El historial solo tiene sentido para un alumno que ya existe — abre
    // el segundo drawer en vez de mostrarse inline (ver historialDrawer.js).
    if (alumnoActual?.id) {
      const historialBtn = document.createElement("button");
      historialBtn.type = "button";
      historialBtn.className = "ac-btn copper";
      historialBtn.style.width = "100%";
      historialBtn.textContent = "Historial de recibos";
      historialBtn.addEventListener("click", () => {
        historialDrawer.open({ id: alumnoActual.id, nombre: alumnoActual.nombre });
      });
      body.appendChild(historialBtn);
    }

    footCtl = esNuevo
      ? buildFootNuevo(msgEl, {
          onCancelar: close,
          onGuardarBorrador: (btn) => guardarBorrador(msgEl, btn),
          onGuardarNuevo: (btn) => guardarNuevo(msgEl, btn),
        })
      : { el: buildFootEditar(msgEl, {
          alumnoActual,
          onCancelar: close,
          onGuardar: (btn) => guardarCambios(msgEl, btn),
          onArchivar: () => archivar(msgEl),
          onRestaurar: (btn) => restaurar(msgEl, btn),
          onEliminarDefinitivo: (btn) => eliminarDefinitivo(msgEl, btn),
        }) };

    drawer.append(buildHead(esNuevo ? "Nuevo alumno" : "Editar alumno", close));
    if (esNuevo) {
      drawer.appendChild(
        buildInscripcionUpload({
          onExtraido: (datos) => {
            sections.datos.setFromOcr({
              nombre: datos.nombre,
              curso: datos.curso,
              telefono: datos.telefono,
              direccion: datos.direccion,
              ciudad: datos.ciudad,
              codigo_postal: datos.codigo_postal,
            });
            aplicarOcrAFamilia(sections.familia, datos);
          },
        })
      );
    }
    drawer.append(body, msgEl, footCtl.el);
  }

  function open(alumno = null) {
    alumnoActual = alumno;
    render();
    overlay.classList.add("open");
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) close();
  });

  return { open, close };
}
