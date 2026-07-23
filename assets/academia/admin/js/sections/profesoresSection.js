import { fetchProfesores, invitarProfesor, revocarInvitacionProfesor } from "../apiProfesores.js";
import { buildTablaProfesores } from "./profesores/tablaProfesores.js";
import { abrirInvitarDialog } from "./profesores/invitarDialog.js";

// Sección "Profesores" del sidebar admin-academia — siempre visible, a
// diferencia de "Control horario" (que depende de un toggle). Reutiliza
// tal cual el flujo de invitación de instituto (GET/POST /admin/teachers,
// ver la auditoría): mismo endpoint, mismo token, mismo email — la única
// diferencia es que aquí no se piden grupos ni asignaturas.
export function createProfesoresSection() {
  let tablaWrap = null;
  let msgEl = null;

  async function cargarTabla() {
    tablaWrap.innerHTML = "";
    tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-loading", textContent: "Cargando…" }));
    try {
      const profesores = await fetchProfesores();
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(buildTablaProfesores(profesores, { onRevocar }));
    } catch (err) {
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-error", textContent: err.message || "No se pudieron cargar los profesores." }));
    }
  }

  async function onRevocar(profesor) {
    msgEl.textContent = "";
    try {
      await revocarInvitacionProfesor(profesor.invite.id);
      msgEl.textContent = "✓ Invitación revocada";
      msgEl.className = "ac-drawer-msg ok";
      await cargarTabla();
    } catch (err) {
      msgEl.textContent = err.message || "No se pudo revocar la invitación.";
      msgEl.className = "ac-drawer-msg error";
    }
  }

  async function onInvitar() {
    const datos = await abrirInvitarDialog();
    if (!datos) return;
    msgEl.textContent = "";
    try {
      const resultado = await invitarProfesor(datos);
      msgEl.textContent = resultado.email_sent === false
        ? `Invitación creada para ${datos.email} (email no enviado — usa el enlace desde Supabase)`
        : `✓ Invitación enviada a ${datos.email}`;
      msgEl.className = "ac-drawer-msg ok";
      await cargarTabla();
    } catch (err) {
      msgEl.textContent = err.message || "No se pudo enviar la invitación.";
      msgEl.className = "ac-drawer-msg error";
    }
  }

  function render(container) {
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Profesores";
    head.appendChild(title);

    const invitarBtn = document.createElement("button");
    invitarBtn.type = "button";
    invitarBtn.className = "ac-btn copper";
    invitarBtn.textContent = "Invitar profesor";
    invitarBtn.addEventListener("click", onInvitar);
    head.appendChild(invitarBtn);

    container.appendChild(head);

    const panel = document.createElement("div");
    panel.className = "ac-panel";

    msgEl = document.createElement("span");
    msgEl.className = "ac-drawer-msg";
    panel.appendChild(msgEl);

    tablaWrap = document.createElement("div");
    panel.appendChild(tablaWrap);
    cargarTabla();

    container.appendChild(panel);
  }

  return { render };
}
