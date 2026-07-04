import { buildIcon } from "./icons.js";
import { nivelInfo } from "./nivel.js";
import { estadoDeEntry } from "./diarioCard.js";
import { buildClaseBody, buildAusenciaEditBody, buildAusenteReadonly } from "./diarioDrawerBody.js";

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

function horaDeEntry(entry) {
  return entry.horarios?.[0] ? formatHora(entry.horarios[0].hora_inicio) : "Extra";
}

function buildHead(entry, close) {
  const head = document.createElement("div");
  head.className = "ac-drawer-head";

  const info = document.createElement("div");
  info.style.flex = "1";
  const title = document.createElement("div");
  title.className = "ac-drawer-title";
  title.textContent = entry.nombre || "(sin nombre)";
  const sub = document.createElement("div");
  sub.className = "ac-drawer-sub";
  const lv = nivelInfo(entry.nivel);
  sub.textContent = `${horaDeEntry(entry)} · ${entry.curso || ""} · ${lv.label}`;
  info.append(title, sub);
  head.appendChild(info);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "ac-drawer-close";
  closeBtn.appendChild(buildIcon("x", { size: 14 }));
  closeBtn.addEventListener("click", close);
  head.appendChild(closeBtn);

  return head;
}

function buildVacio() {
  const p = document.createElement("p");
  p.className = "ac-empty";
  p.textContent = "Selecciona un alumno de la lista.";
  return p;
}

// Columna de detalle del diario — convive junto a la lista (ver
// .ac-diario-split en diario.js), ya no es un overlay position:fixed
// superpuesto encima. No se automonta en ningún sitio: el llamador decide
// dónde colocar `.el` (diario.js lo mete en el split en cada
// fetchYRender()). Al abrir un alumno se ve el formulario de clase (o
// ausente/ausencia-edit según su estado ya guardado); se cierra con la X
// o al guardar, volviendo al estado vacío — a diferencia de otros
// drawers del panel, no se cierra al hacer clic fuera (mismo criterio
// que el drawer de gastos en academia admin — no perder datos por
// accidente).
export function createDiarioDrawer() {
  const el = document.createElement("div");
  el.className = "ac-drawer";
  el.appendChild(buildVacio());

  function close() {
    el.innerHTML = "";
    el.appendChild(buildVacio());
  }

  function render(entry, fecha, modo, onDatosActualizados) {
    el.innerHTML = "";
    el.appendChild(buildHead(entry, close));

    const onMarcarAusente = () => render(entry, fecha, "ausencia-edit", onDatosActualizados);
    // "ausencia-edit" solo se entra desde "clase", así que Deshacer siempre
    // vuelve ahí — igual que Reactivar desde la vista de solo lectura.
    const onCancelarAusencia = () => render(entry, fecha, "clase", onDatosActualizados);
    const onReactivar = () => render(entry, fecha, "clase", onDatosActualizados);
    // Actualiza la lista Y cierra — el caso normal de cualquier guardado.
    const onGuardadoYCerrar = (savedSesion) => {
      onDatosActualizados(savedSesion);
      close();
    };

    if (modo === "ausencia-edit") {
      el.appendChild(buildAusenciaEditBody(entry, fecha, horaDeEntry(entry), {
        onCancelarAusencia,
        onGuardado: onGuardadoYCerrar,
        // Cuando falla el envío del email la ausencia ya se guardó, pero el
        // drawer se queda abierto con el aviso visible — no cierra solo.
        onDatosActualizados,
      }));
    } else if (modo === "ausente") {
      el.appendChild(buildAusenteReadonly(entry, { onReactivar }));
    } else {
      el.appendChild(buildClaseBody(entry, fecha, { onMarcarAusente, onGuardado: onGuardadoYCerrar }));
    }
  }

  // `onDatosActualizados` es específico de cada apertura: quien llama a
  // open() decide qué hacer con la sesión guardada (actualizar la fila
  // correspondiente en la lista del diario), en vez de que el drawer
  // dependa de un callback fijo capturado en su creación.
  function open(entry, fecha, { onGuardado: onDatosActualizados }) {
    const estado = estadoDeEntry(entry);
    const modoInicial = estado === "ausente" ? "ausente" : "clase";
    render(entry, fecha, modoInicial, onDatosActualizados);
  }

  return { el, open, close };
}
