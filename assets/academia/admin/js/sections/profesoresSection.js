import { fetchProfesores, invitarProfesor, revocarInvitacionProfesor } from "../apiProfesores.js";
import { buildTablaProfesores } from "./profesores/tablaProfesores.js";
import { abrirInvitarDialog } from "./profesores/invitarDialog.js";
import { createProfesorDrawer } from "../drawer/profesor/profesorDrawer.js";

// Sección "Profesores" del sidebar admin-academia — siempre visible, a
// diferencia de "Control horario" (que depende de un toggle). Reutiliza
// tal cual el flujo de invitación de instituto (GET/POST /admin/teachers,
// ver la auditoría): mismo endpoint, mismo token, mismo email — la única
// diferencia es que aquí no se piden grupos ni asignaturas.
// `confirmFn` inyectable, mismo criterio que sustitucionesSection.js.
export function createProfesoresSection({ confirmFn = (mensaje) => window.confirm(mensaje) } = {}) {
  let tablaWrap = null;
  let msgEl = null;

  // Igual que alumnosSection.js: el drawer vive montado en document.body,
  // creado una sola vez y reabierto con datos distintos, en vez de
  // reconstruirlo (y apilar overlays) cada vez que se abre.
  const drawer = createProfesorDrawer(document.body, {
    onSaved: () => cargarTabla(),
  });

  async function cargarTabla() {
    tablaWrap.innerHTML = "";
    tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-loading", textContent: "Cargando…" }));
    try {
      const profesores = await fetchProfesores();
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(buildTablaProfesores(profesores, { onRevocar, onAbrir: (profesor) => drawer.open(profesor) }));
    } catch (err) {
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-error", textContent: err.message || "No se pudieron cargar los profesores." }));
    }
  }

  // Revocar era la ÚNICA acción destructiva del panel sin confirmación
  // (auditoría del 08/09/2026): un clic invalidaba el enlace que el profesor
  // tiene en su correo, sin preguntar y sin poder deshacerse. Archivar,
  // eliminar un alumno, borrar un gasto y revocar una sustitución sí
  // preguntaban todas.
  async function onRevocar(profesor) {
    msgEl.textContent = "";
    const quien = profesor?.invite?.email || profesor?.display_name || "este profesor";
    if (!confirmFn(`Se anulará el enlace de invitación de ${quien}. Tendrás que volver a invitarle desde cero. ¿Continuar?`)) return;
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
    invitarBtn.className = "ac-btn primary";
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
