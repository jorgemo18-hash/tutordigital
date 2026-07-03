import { buildDiasTable } from "./diasTable.js";

function buildBtn(texto, claseExtra) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  return btn;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Card del informe de UN alumno dentro de la tab "Informe" — genera, edita
// y envía de forma independiente del resto de alumnos de la familia (una
// familia con hermanos tiene una card por cada uno). `api` agrupa las
// llamadas que necesita (fetchInformePreview/generarInforme/
// editarComentarioInforme/enviarInforme), pasadas explícitas por el
// llamador (ver tabInforme.js) — `onCambio` avisa al panel para refrescar
// solo los puntos de estado de la lista, sin remontar esta card.
export function buildInformeCard(alumno, { mes, anio, api, onCambio }) {
  const card = document.createElement("div");
  card.className = "ac-panel ef-informe-card";

  const nombre = document.createElement("div");
  nombre.className = "ef-informe-card-nombre";
  nombre.textContent = alumno.curso ? `${alumno.nombre} · ${alumno.curso}` : alumno.nombre;
  card.appendChild(nombre);

  const cuerpo = document.createElement("div");
  card.appendChild(cuerpo);

  let estado = { comentario: null, dias: [], enviadoAt: null };
  let editando = false;

  function renderCargando() {
    cuerpo.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-loading";
    p.textContent = "Cargando…";
    cuerpo.appendChild(p);
  }

  function buildMsg() {
    const msg = document.createElement("span");
    msg.className = "ac-drawer-msg";
    return msg;
  }

  function renderVista() {
    cuerpo.innerHTML = "";

    // Sin sesiones ese mes: no tiene sentido ofrecer "Generar informe" sobre
    // cero actividad — solo lectura, sin botones. Va antes que cualquier
    // otro estado (incluso si hubiera un comentario de un mes con datos que
    // ya no existen).
    if (!estado.dias.length) {
      const p = document.createElement("p");
      p.className = "ac-empty";
      p.textContent = "Sin actividad registrada este mes.";
      cuerpo.appendChild(p);
      return;
    }

    cuerpo.appendChild(buildDiasTable(estado.dias));
    const msg = buildMsg();

    if (!estado.comentario) {
      const generarBtn = buildBtn("Generar informe", "primary");
      generarBtn.addEventListener("click", () => accionGenerar(generarBtn, msg, false));
      cuerpo.append(generarBtn, msg);
      return;
    }

    if (editando) {
      const textarea = document.createElement("textarea");
      textarea.className = "ac-textarea";
      textarea.rows = 4;
      textarea.value = estado.comentario;
      cuerpo.appendChild(textarea);

      const acciones = document.createElement("div");
      acciones.className = "ef-informe-fila";
      const cancelarBtn = buildBtn("Cancelar", "ghost");
      cancelarBtn.addEventListener("click", () => { editando = false; renderVista(); });
      const guardarBtn = buildBtn("Guardar", "primary");
      guardarBtn.addEventListener("click", () => accionGuardarEdicion(guardarBtn, textarea, msg));
      acciones.append(cancelarBtn, guardarBtn);
      cuerpo.append(acciones, msg);
      return;
    }

    const texto = document.createElement("p");
    texto.className = "ef-informe-comentario";
    texto.textContent = estado.comentario;
    cuerpo.appendChild(texto);

    if (estado.enviadoAt) {
      const badge = document.createElement("span");
      badge.className = "ac-estado-badge pagado";
      badge.textContent = `Enviado el ${formatFecha(estado.enviadoAt)}`;
      cuerpo.appendChild(badge);
      return;
    }

    const acciones = document.createElement("div");
    acciones.className = "ef-informe-fila";
    const regenerarBtn = buildBtn("Regenerar informe", "ghost");
    regenerarBtn.addEventListener("click", () => accionGenerar(regenerarBtn, msg, true));
    const editarBtn = buildBtn("Editar informe", "ghost");
    editarBtn.addEventListener("click", () => { editando = true; renderVista(); });
    const enviarBtn = buildBtn("Enviar informe", "primary");
    enviarBtn.addEventListener("click", () => accionEnviar(enviarBtn, msg));
    acciones.append(regenerarBtn, editarBtn, enviarBtn);
    cuerpo.append(acciones, msg);
  }

  async function accionGenerar(boton, msg, forzar) {
    boton.disabled = true;
    msg.textContent = "";
    try {
      const res = await api.generarInforme({ alumno_id: alumno.id, mes, anio, forzar });
      estado = { comentario: res.comentario, dias: res.dias, enviadoAt: forzar ? null : estado.enviadoAt };
      renderVista();
    } catch (err) {
      boton.disabled = false;
      msg.textContent = err.message || "No se pudo generar el informe.";
      msg.className = "ac-drawer-msg error";
    }
  }

  async function accionGuardarEdicion(boton, textarea, msg) {
    boton.disabled = true;
    msg.textContent = "";
    try {
      const res = await api.editarComentarioInforme({ alumno_id: alumno.id, mes, anio, comentario: textarea.value.trim() });
      estado.comentario = res.comentario;
      editando = false;
      renderVista();
    } catch (err) {
      boton.disabled = false;
      msg.textContent = err.message || "No se pudo guardar.";
      msg.className = "ac-drawer-msg error";
    }
  }

  async function accionEnviar(boton, msg) {
    boton.disabled = true;
    msg.textContent = "";
    try {
      await api.enviarInforme({ alumno_id: alumno.id, mes, anio });
      estado.enviadoAt = new Date().toISOString();
      renderVista();
      onCambio();
    } catch (err) {
      boton.disabled = false;
      msg.textContent = err.message || "No se pudo enviar.";
      msg.className = "ac-drawer-msg error";
    }
  }

  renderCargando();
  api.fetchInformePreview(alumno.id, { mes, anio })
    .then((preview) => {
      estado = { comentario: preview.comentario, dias: preview.dias, enviadoAt: preview.enviadoAt };
      renderVista();
    })
    .catch((err) => {
      cuerpo.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el informe.";
      cuerpo.appendChild(p);
    });

  return card;
}
