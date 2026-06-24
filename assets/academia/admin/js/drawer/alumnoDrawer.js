import { buildDatosSection } from "./datosSection.js";
import { buildFamiliaSection } from "./familiaSection.js";
import { buildHorarioSection } from "./horarioSection.js";
import { buildTarifaSection } from "./tarifaSection.js";
import { buildInscripcionUpload } from "./inscripcionUpload.js";
import { createAlumno, updateAlumno, updateHorarioAlumno, archivarAlumno } from "../api.js";
import { buildIcon } from "../icons.js";

const METODO_PAGO_OCR = { sepa: "domiciliado" };
const FAMILIA_OCR_KEYS = ["email", "telefono", "dni", "direccion", "ciudad", "codigo_postal"];

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

export function createAlumnoDrawer(root, { familias, config, onSaved }) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  let alumnoActual = null;
  let sections = {};

  function close() {
    overlay.classList.remove("open");
  }

  function recogerPayloadComun(msgEl) {
    const datos = sections.datos.getValue();
    if (!datos.nombre || !datos.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return null;
    }
    const tarifa = sections.tarifa.getValue();
    return { ...datos, ...sections.familia.getValue(), tarifa };
  }

  async function guardarNuevo(msgEl, saveBtn, { activo } = {}) {
    const payload = recogerPayloadComun(msgEl);
    if (!payload) return;
    payload.horario = sections.horario.getValue();
    if (activo !== undefined) payload.activo = activo;
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

  async function guardarBorrador(msgEl, draftBtn) {
    const datos = sections.datos.getValue();
    if (!datos.nombre || !datos.curso) {
      showMsg(msgEl, "Nombre y curso son obligatorios.");
      return;
    }
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

  // Con datos de OCR sin revisar todavía, "Guardar alumno" deja al alumno
  // como pendiente (activo=false) y aparece además "Guardar y activar"
  // para confirmarlo directamente. Sin OCR, el flujo es el de siempre.
  function buildFootNuevo(msgEl, { ocrApplied = false } = {}) {
    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ac-btn ghost";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", close);

    const right = document.createElement("div");
    right.className = "ac-drawer-foot-right";
    const draftBtn = document.createElement("button");
    draftBtn.type = "button";
    draftBtn.className = "ac-btn ghost";
    draftBtn.textContent = "Borrador";
    draftBtn.addEventListener("click", () => guardarBorrador(msgEl, draftBtn));
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = ocrApplied ? "ac-btn ghost" : "ac-btn primary";
    saveBtn.textContent = "Guardar alumno";
    saveBtn.addEventListener("click", () => guardarNuevo(msgEl, saveBtn, ocrApplied ? { activo: false } : {}));
    right.append(draftBtn, saveBtn);

    if (ocrApplied) {
      const activarBtn = document.createElement("button");
      activarBtn.type = "button";
      activarBtn.className = "ac-btn primary";
      activarBtn.textContent = "Guardar y activar";
      activarBtn.addEventListener("click", () => guardarNuevo(msgEl, activarBtn, { activo: true }));
      right.appendChild(activarBtn);
    }

    foot.append(cancelBtn, right);
    return foot;
  }

  function buildFootEditar(msgEl) {
    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";

    const archivarBtn = document.createElement("button");
    archivarBtn.type = "button";
    archivarBtn.className = "ac-btn danger";
    archivarBtn.textContent = "Archivar alumno";
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

    const right = document.createElement("div");
    right.className = "ac-drawer-foot-right";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ac-btn ghost";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", close);
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar cambios";
    saveBtn.addEventListener("click", () => guardarCambios(msgEl, saveBtn));
    right.append(cancelBtn, saveBtn);

    foot.append(archivarBtn, right);
    return foot;
  }

  function render() {
    drawer.innerHTML = "";
    const esNuevo = !alumnoActual;
    const msgEl = buildMsg();
    let ocrApplied = false;

    sections = {
      datos: buildDatosSection({
        nombre: alumnoActual?.nombre,
        curso: alumnoActual?.curso,
        fechaAlta: alumnoActual?.fecha_alta,
      }),
      familia: buildFamiliaSection({ familias, familiaActual: alumnoActual?.familia || null }),
      horario: buildHorarioSection({ config, horarioActual: alumnoActual?.horario || [] }),
      tarifa: buildTarifaSection({ tarifaActual: alumnoActual?.tarifa || null }),
    };

    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    body.append(sections.datos.wrap, sections.familia.wrap, sections.horario.wrap, sections.tarifa.wrap);

    let footEl = esNuevo ? buildFootNuevo(msgEl, { ocrApplied }) : buildFootEditar(msgEl);

    drawer.append(buildHead(esNuevo ? "Nuevo alumno" : "Editar alumno", close));
    if (esNuevo) {
      drawer.appendChild(
        buildInscripcionUpload({
          onExtraido: (datos) => {
            sections.datos.setFromOcr({ nombre: datos.nombre, curso: datos.curso });
            aplicarOcrAFamilia(sections.familia, datos);
            ocrApplied = true;
            const nuevoFoot = buildFootNuevo(msgEl, { ocrApplied });
            footEl.replaceWith(nuevoFoot);
            footEl = nuevoFoot;
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
