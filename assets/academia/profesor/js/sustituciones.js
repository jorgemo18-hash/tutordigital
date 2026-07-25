import { fetchProfesoresParaSustitucion, fetchMisSustituciones, declararSustitucion } from "./api.js";
import { escHtml } from "../../../shared/js/escHtml.js";

// "Sustituciones" — el profesor solo puede autodeclarar una sustitución
// para HOY (no hay selector de fechas: el backend las fuerza igual, esto
// es solo para que la UI no prometa algo que la API rechazaría). Nunca
// es "abrir el panel de otro profesor" — el sustituto sigue siendo él
// mismo, con su propio nombre; la sustitución solo amplía qué alumnos ve
// en Horario/Diario mientras esté activa.
function buildBodyHead() {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const titleBox = document.createElement("div");
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.innerHTML = "Sustitu<em>ciones</em>";
  const sub = document.createElement("div");
  sub.className = "ac-sub";
  sub.textContent = "Cubrir a un compañero hoy";
  titleBox.append(title, sub);
  head.appendChild(titleBox);
  return head;
}

function buildActivaItem(sustitucion) {
  const item = document.createElement("div");
  item.className = "ac-sust-item";
  const texto = document.createElement("span");
  texto.textContent = sustitucion.soy_sustituto
    ? `Hoy cubres a ${sustitucion.sustituido_nombre || "un profesor"}`
    : `Hoy te cubre ${sustitucion.sustituto_nombre || "un profesor"}`;
  const badge = document.createElement("span");
  badge.className = `ac-sust-badge ${sustitucion.soy_sustituto ? "sustituto" : "sustituido"}`;
  badge.textContent = sustitucion.soy_sustituto ? "Sustituto" : "Sustituido";
  item.append(texto, badge);
  return item;
}

function buildActivasSection(sustituciones) {
  const section = document.createElement("div");
  section.className = "ac-panel";
  const label = document.createElement("div");
  label.className = "ac-field-label";
  label.textContent = "Tus sustituciones activas hoy";
  section.appendChild(label);

  if (sustituciones.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "No tienes ninguna sustitución activa hoy.";
    section.appendChild(empty);
    return section;
  }
  for (const s of sustituciones) section.appendChild(buildActivaItem(s));
  return section;
}

// Formulario en dos pasos: elegir compañero -> confirmar antes de
// declarar. Sin selector de fechas a propósito (ver comentario de
// arriba) — evita prometer un rango que el backend rechazaría con 403.
function buildDeclararSection(profesores, { declararFn, onDeclarada }) {
  const section = document.createElement("div");
  section.className = "ac-panel";
  const label = document.createElement("div");
  label.className = "ac-field-label";
  label.textContent = "Declarar una sustitución para hoy";
  section.appendChild(label);

  if (profesores.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "No hay más profesores en este centro a quien sustituir.";
    section.appendChild(empty);
    return section;
  }

  const select = document.createElement("select");
  select.className = "ac-input";
  for (const p of profesores) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.display_name;
    select.appendChild(opt);
  }

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  const declararBtn = document.createElement("button");
  declararBtn.type = "button";
  declararBtn.className = "ac-btn primary";
  declararBtn.textContent = "Declarar sustitución";

  const confirmBox = document.createElement("div");
  confirmBox.className = "ac-sust-confirm hidden";
  const confirmTexto = document.createElement("span");
  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "ac-btn primary";
  confirmBtn.textContent = "Confirmar";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "ac-btn ghost";
  cancelBtn.textContent = "Cancelar";
  confirmBox.append(confirmTexto, confirmBtn, cancelBtn);

  declararBtn.addEventListener("click", () => {
    const nombre = select.selectedOptions[0]?.textContent || "este profesor";
    confirmTexto.textContent = `¿Confirmas que cubres a ${nombre} hoy?`;
    confirmBox.classList.remove("hidden");
    declararBtn.disabled = true;
  });

  cancelBtn.addEventListener("click", () => {
    confirmBox.classList.add("hidden");
    declararBtn.disabled = false;
  });

  confirmBtn.addEventListener("click", async () => {
    confirmBtn.disabled = true;
    try {
      await declararFn(select.value);
      msg.textContent = "✓ Sustitución declarada";
      msg.className = "ac-drawer-msg ok";
      confirmBox.classList.add("hidden");
      declararBtn.disabled = false;
      onDeclarada();
    } catch (err) {
      msg.textContent = err.message || "No se pudo declarar la sustitución.";
      msg.className = "ac-drawer-msg error";
      confirmBtn.disabled = false;
    }
  });

  section.append(select, declararBtn, confirmBox, msg);
  return section;
}

export async function renderSustituciones(container, {
  fetchProfesoresFn = fetchProfesoresParaSustitucion,
  fetchMisSustitucionesFn = fetchMisSustituciones,
  declararFn = declararSustitucion,
} = {}) {
  if (!container) return;
  container.innerHTML = '<p class="ac-loading">Cargando sustituciones…</p>';

  async function cargarYPintar() {
    try {
      const [profesores, sustituciones] = await Promise.all([fetchProfesoresFn(), fetchMisSustitucionesFn()]);
      container.innerHTML = "";
      container.appendChild(buildBodyHead());
      container.appendChild(buildActivasSection(sustituciones));
      container.appendChild(buildDeclararSection(profesores, { declararFn, onDeclarada: cargarYPintar }));
    } catch (err) {
      container.innerHTML = `<p class="ac-error">${escHtml(err.message || "Error al cargar las sustituciones.")}</p>`;
    }
  }

  await cargarYPintar();
}
