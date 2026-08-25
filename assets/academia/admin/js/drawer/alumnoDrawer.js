import { buildDatosSection } from "./datosSection.js";
import { buildFamiliaSection } from "./familiaSection.js";
import { buildHorarioSection } from "./horarioSection.js";
import { buildTarifaSection } from "./tarifaSection.js";
import { buildDescuentosRecurrentesSection, buildDescuentosNuevoAlumno } from "./descuentosRecurrentesSection.js";
import { buildEconomicoFamiliaSection } from "./economicoFamiliaSection.js";
import { buildInscripcionUpload } from "./inscripcionUpload.js";
import { createHistorialDrawer } from "./historial/historialDrawer.js";
import { createSelectorFamiliaDrawer } from "./familia/selectorFamiliaDrawer.js";
import { createAlumnoDrawerActions } from "./alumnoDrawerActions.js";
import { buildFootNuevo, buildFootEditar } from "./alumnoDrawerFoot.js";
import { buildIcon } from "../icons.js";
import { createUnsavedChangesGuard } from "../../../../shared/js/unsavedChanges/unsavedChangesGuard.js";
import { snapshotFormValues } from "../../../../shared/js/unsavedChanges/snapshotFormValues.js";
import { attachCierreConGuarda } from "../../../../shared/js/unsavedChanges/attachCierreConGuarda.js";

// El OCR ya llega repartido en { alumno, familia } y con el método de pago
// traducido ("sepa" -> "domiciliado") desde el servidor, ver
// server/lib/academiaInscripciones/normalizarDatosOcr.js. Antes se repartía
// aquí y solo el email cruzaba a la familia, así que el nombre del tutor,
// su DNI, su teléfono y su dirección se perdían en cada alta.

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

// Deja preparados los datos del tutor para cuando se abra "Crear familia".
// El normalizador ya omite las claves vacías, así que un campo que el OCR
// no encontró no puede borrar lo que el admin hubiera escrito.
function aplicarOcrAFamilia(familiaSection, familiaOcr = {}) {
  familiaSection.prefillNueva({ ...familiaOcr });
}

function buildMsg() {
  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";
  return msg;
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
  // Este es el cierre INCONDICIONAL — el que usan Guardar/Cancelar/
  // Archivar/etc., que deben cerrar siempre. El clic-fuera/Escape
  // (accidental) pasa por intentarCerrarAccidental() más abajo, no por aquí.
  function close() {
    overlay.classList.remove("open");
    historialDrawer.close();
    selectorFamiliaDrawer.close();
  }

  const { guardarNuevo, guardarBorrador, guardarCambios, archivar, restaurar, eliminarDefinitivo } =
    createAlumnoDrawerActions({
      getSections: () => sections,
      getAlumnoActual: () => alumnoActual,
      onSaved,
      close,
    });

  // Cambios sin guardar del formulario propio (datos/familia/horario/
  // tarifa/descuentos de un alumno nuevo) — comparado contra su valor al
  // terminar render(). `sections.descuentos` (checkboxes de un alumno YA
  // EXISTENTE) queda fuera a propósito: se guardan al instante contra su
  // id (ver descuentosRecurrentesSection.js), no hay nada sin guardar que
  // perder ahí — incluirlos dispararía una confirmación falsa nada más
  // marcar/desmarcar uno.
  function snapshotAlumnoForm() {
    const partes = [
      sections.datos?.wrap,
      sections.familia?.wrap,
      sections.horario?.wrap,
      sections.tarifa?.wrap,
      sections.descuentosNuevo?.wrap,
    ].filter(Boolean);
    return partes.flatMap((wrap) => snapshotFormValues(wrap));
  }
  const guard = createUnsavedChangesGuard({ getSnapshot: snapshotAlumnoForm });
  const intentarCerrarPropio = attachCierreConGuarda({ guard, cerrarFn: close });

  // Antes de cerrar por clic-fuera/Escape: si el drawer de selección de
  // familia (anidado) tiene cambios sin guardar, se le cede la decisión a
  // él primero (mismo criterio que closeTaskPickerDrawer con
  // bulk-grade-drawer) — solo si accede (o no aplica) se consulta el
  // guard de este propio nivel. historialDrawer/reciboDrawer quedan
  // fuera: son de solo lectura, cerrarlos nunca pierde nada.
  function intentarCerrarAccidental() {
    if (selectorFamiliaDrawer.tieneCambiosSinGuardar()) {
      return selectorFamiliaDrawer.intentarCerrarTodo();
    }
    return intentarCerrarPropio();
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
    sections.tarifa = buildTarifaSection({ tarifaActual: alumnoActual?.tarifa || null });
    sections.familia = buildFamiliaSection({
      familiaActual: alumnoActual?.familia || null,
      esAlumnoExistente: !esNuevo,
      alumnoId: alumnoActual?.id || null,
      selectorFamiliaDrawer,
      // Al elegir/crear una familia en el segundo drawer, su contacto
      // prerellena "Datos del alumno" (sigue editable después) y recarga el
      // bloque económico con la familia nueva — sección distinta, mismo
      // cambio de origen.
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
      sections.descuentos = buildDescuentosRecurrentesSection({
        alumnoId: alumnoActual.id,
        // Getter en vivo, no un valor fijo — sections.economicoFamilia
        // todavía no existe en este punto de render() (se construye justo
        // debajo), pero para cuando esto se invoca de verdad (tras marcar/
        // desmarcar un descuento) ya existe.
        getFamiliaId: () => sections.familia?.getValue()?.familia_id || null,
        onGuardado: () => sections.economicoFamilia?.refresh(sections.familia?.getValue()?.familia_id || null),
      });
      grupoTarifaDescuentos.appendChild(sections.descuentos.wrap);
    }
    body.appendChild(grupoTarifaDescuentos);
    // La foto económica familiar, igual que el historial, solo tiene
    // sentido para un alumno que ya existe (necesita una familia ya
    // vinculada de la que leer hermanos/tarifas reales) — para uno nuevo no
    // se muestra nada económico de la familia todavía.
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
            sections.datos.setFromOcr(datos.alumno || {});
            aplicarOcrAFamilia(sections.familia, datos.familia);
          },
        })
      );
    }
    drawer.append(body, msgEl, footCtl.el);
    // Todas las secciones ya están pintadas con sus valores de partida —
    // lo que pase a partir de aquí (incluido el prefillContacto disparado
    // al elegir familia) sí cuenta como cambio.
    guard.marcarLimpio();
  }

  function open(alumno = null) {
    alumnoActual = alumno;
    render();
    overlay.classList.add("open");
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) intentarCerrarAccidental(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) intentarCerrarAccidental();
  });

  return { open, close };
}
