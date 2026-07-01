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

// Drawer lateral de detalle del diario — sustituye al acordeón: al abrir un
// alumno se ve el formulario de clase (o ausente/ausencia-edit según su
// estado ya guardado). Se cierra con la X o al guardar; a diferencia de
// otros drawers del panel, no se cierra al hacer clic fuera (mismo criterio
// que el drawer de gastos en academia admin — no perder datos por accidente).
export function createDiarioDrawer(root) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  function close() {
    overlay.classList.remove("open");
  }

  function render(entry, fecha, modo, onGuardado) {
    drawer.innerHTML = "";
    drawer.appendChild(buildHead(entry, close));

    const onMarcarAusente = () => render(entry, fecha, "ausencia-edit", onGuardado);
    // "ausencia-edit" solo se entra desde "clase", así que Deshacer siempre
    // vuelve ahí — igual que Reactivar desde la vista de solo lectura.
    const onCancelarAusencia = () => render(entry, fecha, "clase", onGuardado);
    const onReactivar = () => render(entry, fecha, "clase", onGuardado);
    const onGuardadoInterno = (savedSesion) => {
      onGuardado(savedSesion);
      close();
    };

    if (modo === "ausencia-edit") {
      drawer.appendChild(buildAusenciaEditBody(entry, fecha, { onCancelarAusencia, onGuardado: onGuardadoInterno }));
    } else if (modo === "ausente") {
      drawer.appendChild(buildAusenteReadonly(entry, { onReactivar }));
    } else {
      drawer.appendChild(buildClaseBody(entry, fecha, { onMarcarAusente, onGuardado: onGuardadoInterno }));
    }
  }

  // `onGuardado` es específico de cada apertura: quien llama a open() decide
  // qué hacer con la sesión guardada (actualizar la fila correspondiente en
  // la lista del diario), en vez de que el drawer dependa de un callback
  // fijo capturado en su creación.
  function open(entry, fecha, { onGuardado }) {
    const estado = estadoDeEntry(entry);
    const modoInicial = estado === "ausente" ? "ausente" : "clase";
    render(entry, fecha, modoInicial, onGuardado);
    overlay.classList.add("open");
  }

  return { open, close };
}
