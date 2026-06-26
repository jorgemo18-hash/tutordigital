import { buildDatosSection } from "./datosSection.js";
import { buildFamiliaSection } from "./familiaSection.js";
import { buildHorarioSection } from "./horarioSection.js";
import { buildTarifaSection } from "./tarifaSection.js";
import { buildDescuentosRecurrentesSection } from "./descuentosRecurrentesSection.js";
import { buildInscripcionUpload } from "./inscripcionUpload.js";
import { createHistorialDrawer } from "./historial/historialDrawer.js";
import { createSelectorFamiliaDrawer } from "./familia/selectorFamiliaDrawer.js";
import { createAlumno, updateAlumno, updateHorarioAlumno, archivarAlumno } from "../api.js";
import { buildIcon } from "../icons.js";

const METODO_PAGO_OCR = { sepa: "domiciliado" };
// El teléfono/dirección/ciudad/CP del OCR van a "Datos del alumno" (ver
// onExtraido más abajo) — aquí solo queda lo que sigue siendo de familia.
const FAMILIA_OCR_KEYS = ["email"];
// TODO: academia_alumnos no tiene columnas propias para el contacto del
// alumno todavía — mientras tanto se guardan en la familia vinculada (si
// hay alguna en este guardado). Sin familia, no hay dónde persistirlos.
const ALUMNO_CONTACTO_KEYS = ["email", "telefono", "direccion", "ciudad", "codigo_postal"];

function separarContactoAlumno(datos) {
  const contacto = {};
  const resto = { ...datos };
  for (const key of ALUMNO_CONTACTO_KEYS) {
    contacto[key] = resto[key] || null;
    delete resto[key];
  }
  return { resto, contacto };
}

// Solo sobreescribe los campos de familia para los que el alumno SÍ tiene
// un valor no vacío — así no se borra un dato de familia ya guardado.
function mergeContactoEnFamilia(contacto, familiaValue) {
  const overrides = Object.fromEntries(Object.entries(contacto).filter(([, v]) => v));
  if (!Object.keys(overrides).length) return familiaValue;
  if (familiaValue.familia_nueva) {
    return { ...familiaValue, familia_nueva: { ...familiaValue.familia_nueva, ...overrides } };
  }
  if (familiaValue.familia_actualizada) {
    return { ...familiaValue, familia_actualizada: { ...familiaValue.familia_actualizada, ...overrides } };
  }
  return familiaValue;
}

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

function buildFootBtn(texto, clase) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${clase}`;
  btn.textContent = texto;
  return btn;
}

// Pie del drawer en modo confirmación inline para archivar — sin window.confirm.
function buildArchivarConfirm(nombre, { onConfirmar, onCancelar }) {
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

  function recogerPayloadComun(msgEl) {
    const datosRaw = sections.datos.getValue();
    if (!datosRaw.nombre || !datosRaw.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return null;
    }
    const { resto: datos, contacto } = separarContactoAlumno(datosRaw);
    const tarifa = sections.tarifa.getValue();
    const familiaValue = mergeContactoEnFamilia(contacto, sections.familia.getValue());
    if (!familiaValue.familia_id) {
      sections.familia.showError("Es obligatorio asignar una familia");
      sections.familia.wrap.scrollIntoView({ behavior: "smooth", block: "start" });
      return null;
    }
    return { ...datos, ...familiaValue, tarifa };
  }

  async function guardarNuevo(msgEl, saveBtn) {
    const payload = recogerPayloadComun(msgEl);
    if (!payload) return;
    payload.horario = sections.horario.getValue();
    saveBtn.disabled = true;
    try {
      const alumno = await createAlumno(payload);
      onSaved(alumno);
      close();
    } catch (err) {
      showMsg(msgEl, err.message || "No se pudo crear el alumno.");
      saveBtn.disabled = false;
    }
  }

  // Guarda solo nombre+curso, sin familia/horario/tarifa, como pendiente
  // de completar — por eso siempre queda activo:false (aparece en la
  // pestaña "Pendientes" hasta que el admin lo revise y guarde del todo).
  async function guardarBorrador(msgEl, draftBtn) {
    const datosRaw = sections.datos.getValue();
    if (!datosRaw.nombre || !datosRaw.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return;
    }
    // El borrador no vincula familia, así que el contacto del alumno no
    // tiene dónde guardarse todavía (ver TODO arriba) — se descarta aquí.
    const { resto: datos } = separarContactoAlumno(datosRaw);
    datos.activo = false;
    draftBtn.disabled = true;
    try {
      const alumno = await createAlumno(datos);
      onSaved(alumno);
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

  // Una sola fila, siempre estos 3 botones en este orden — nunca el pie
  // hace wrap (ver .ac-drawer-foot en el CSS, tamaño compacto a propósito).
  function buildFootNuevo(msgEl) {
    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";

    const cancelBtn = buildFootBtn("Cancelar", "ghost");
    cancelBtn.addEventListener("click", close);
    const draftBtn = buildFootBtn("Borrador", "ghost");
    draftBtn.addEventListener("click", () => guardarBorrador(msgEl, draftBtn));
    const saveBtn = buildFootBtn("Guardar", "primary");
    saveBtn.addEventListener("click", () => guardarNuevo(msgEl, saveBtn));

    foot.append(cancelBtn, draftBtn, saveBtn);
    return foot;
  }

  function buildFootEditar(msgEl) {
    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";

    const cancelBtn = buildFootBtn("Cancelar", "ghost");
    cancelBtn.addEventListener("click", close);
    const archivarBtn = buildFootBtn("Archivar", "danger");
    archivarBtn.addEventListener("click", () => {
      const confirmFoot = buildArchivarConfirm(alumnoActual.nombre, {
        onCancelar: () => foot.replaceWith(buildFootEditar(msgEl)),
        onConfirmar: async () => {
          try {
            await archivarAlumno(alumnoActual.id);
            onSaved(null);
            close();
          } catch (err) {
            showMsg(msgEl, err.message || "No se pudo archivar el alumno.");
          }
        },
      });
      foot.replaceWith(confirmFoot);
    });
    const saveBtn = buildFootBtn("Guardar", "primary");
    saveBtn.addEventListener("click", () => guardarCambios(msgEl, saveBtn));

    foot.append(cancelBtn, archivarBtn, saveBtn);
    return foot;
  }

  function render() {
    drawer.innerHTML = "";
    const esNuevo = !alumnoActual;
    const msgEl = buildMsg();

    sections = {};
    // La tarifa se construye antes para que "Familia completa" pueda leer
    // su valor en vivo (getTarifaActual) sin duplicar esos campos.
    sections.tarifa = buildTarifaSection({
      tarifaActual: alumnoActual?.tarifa || null,
      onChange: () => sections.familia?.refreshTotal(),
    });
    sections.familia = buildFamiliaSection({
      familiaActual: alumnoActual?.familia || null,
      selectorFamiliaDrawer,
      getTarifaActual: () => sections.tarifa.getValue(),
      // Al elegir/crear una familia en el segundo drawer, su contacto
      // prerellena "Datos del alumno" (sigue editable después).
      onFamiliaCambio: (familia) => sections.datos.prefillContacto(familia || {}),
    });
    sections.datos = buildDatosSection({
      nombre: alumnoActual?.nombre,
      curso: alumnoActual?.curso,
      fechaAlta: alumnoActual?.fecha_alta,
      // Fallback: el contacto del alumno hoy vive en la familia (ver TODO).
      email: alumnoActual?.familia?.email,
      telefono: alumnoActual?.familia?.telefono,
      direccion: alumnoActual?.familia?.direccion,
      ciudad: alumnoActual?.familia?.ciudad,
      codigoPostal: alumnoActual?.familia?.codigo_postal,
    });
    sections.horario = buildHorarioSection({ config, horarioActual: alumnoActual?.horario || [] });

    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    // FAMILIA va primero: agrupa al alumno bajo un tutor/email/método de
    // pago antes de pedir los datos propios del alumno.
    body.append(sections.familia.wrap, sections.datos.wrap, sections.horario.wrap, sections.tarifa.wrap);
    // Igual que el historial: solo tiene sentido para un alumno que ya
    // existe (uno nuevo no tiene id todavía al que asociar el descuento).
    if (alumnoActual?.id) {
      sections.descuentos = buildDescuentosRecurrentesSection({ alumnoId: alumnoActual.id });
      body.appendChild(sections.descuentos.wrap);
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

    const footEl = esNuevo ? buildFootNuevo(msgEl) : buildFootEditar(msgEl);

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
    drawer.append(body, msgEl, footEl);
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
