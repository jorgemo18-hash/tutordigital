import { buildDiasTable } from "./diasTable.js";
import { buildRegenerarBoton } from "./regenerarBoton.js";

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

// Card del informe de UN alumno dentro de la tab "Informe" — genera y edita
// de forma independiente del resto de alumnos de la familia (una familia
// con hermanos tiene una card por cada uno). Regenerar/Enviar ya NO viven
// aquí — se consolidaron en los dos botones únicos junto al selector
// Informe/Recibo (ver acciones/accionesFamiliaBoton.js), con una opción
// "[Verbo] informe de [nombre]" por cada alumno. `api` agrupa las
// llamadas que necesita (fetchInformePreview/generarInforme/
// editarComentarioInforme), pasadas explícitas por el llamador (ver
// tabInforme.js).
export function buildInformeCard(alumno, { mes, anio, api }) {
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
    cuerpo.appendChild(buildDiasTable(estado.dias));
    const msg = buildMsg();

    if (!estado.comentario) {
      cuerpo.append(buildGenerarInformeBoton(msg), msg);
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
      const cancelarBtn = buildBtn("Cancelar", "copper");
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

    // Enviado: sin acciones aquí (regenerar/reenviar viven en el nivel
    // familia) y sin "Editar" — un informe ya comunicado no se edita a
    // mano por sorpresa, igual que antes de este rediseño.
    if (estado.enviadoAt) {
      const badge = document.createElement("span");
      badge.className = "ac-estado-badge pagado";
      badge.textContent = `Enviado el ${formatFecha(estado.enviadoAt)}`;
      cuerpo.appendChild(badge);
      return;
    }

    const acciones = document.createElement("div");
    acciones.className = "ef-informe-fila";
    const editarBtn = buildBtn("Editar informe", "copper");
    editarBtn.addEventListener("click", () => { editando = true; renderVista(); });
    acciones.appendChild(editarBtn);
    cuerpo.append(acciones, msg);
  }

  function buildGenerarInformeBoton(msg) {
    return buildRegenerarBoton({
      textoIdle: "Generar informe",
      textoCargando: "Generando…",
      textoOk: "✓ Generado",
      ejecutar: async () => {
        const res = await api.generarInforme({ alumno_id: alumno.id, mes, anio, forzar: false });
        estado = { comentario: res.comentario, dias: res.dias, enviadoAt: estado.enviadoAt };
        renderVista();
        return res;
      },
      onError: (err) => { msg.textContent = err.message || "No se pudo generar el informe."; msg.className = "ac-drawer-msg error"; },
    });
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

  renderCargando();
  api.fetchInformePreview(alumno.id, { mes, anio })
    .then(async (preview) => {
      estado = { comentario: preview.comentario, dias: preview.dias, enviadoAt: preview.enviadoAt };
      // Sin días que informar y sin comentario todavía: el backend
      // devuelve el texto fijo "Sin actividad..." sin gastar IA (ver
      // generarYGuardarComentario) — se guarda ya aquí para saltar
      // directamente al render normal de "con comentario" (sin botón
      // "Generar informe": no hay nada que generar) y que Editar funcione
      // igual que con un informe con datos.
      if (!estado.dias.length && !estado.comentario) {
        const res = await api.generarInforme({ alumno_id: alumno.id, mes, anio, forzar: false });
        estado.comentario = res.comentario;
      }
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
