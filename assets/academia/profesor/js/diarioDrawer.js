import { buildIcon } from "./icons.js";
import { nivelInfo } from "./nivel.js";
import { estadoDeEntry } from "./diarioCard.js";
import { buildClaseBody, buildAusenciaEditBody, buildAusenteReadonly } from "./diarioDrawerBody.js";
import { createUnsavedChangesGuard } from "../../../shared/js/unsavedChanges/unsavedChangesGuard.js";
import { snapshotFormValues } from "../../../shared/js/unsavedChanges/snapshotFormValues.js";
import { attachCierreConGuarda } from "../../../shared/js/unsavedChanges/attachCierreConGuarda.js";

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
// estado ya guardado). Se cierra con la X o al guardar; el clic fuera y
// Escape pasan por la guarda de cambios sin guardar (mismo patrón que el
// resto del panel, ver gastoDrawer.js) en vez de no cerrarse nunca.
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

  // El body se repinta entero en cada render() (cambio de modo incluido),
  // así que escanea `drawer` en vivo en vez de guardar una referencia — la
  // vista "ausente" (solo lectura) no tiene inputs, da snapshot vacío.
  const guard = createUnsavedChangesGuard({ getSnapshot: () => snapshotFormValues(drawer) });
  const intentarCerrarAccidental = attachCierreConGuarda({ guard, cerrarFn: close });

  function render(entry, fecha, modo, onDatosActualizados) {
    drawer.innerHTML = "";
    drawer.appendChild(buildHead(entry, close));

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
      drawer.appendChild(buildAusenciaEditBody(entry, fecha, horaDeEntry(entry), {
        onCancelarAusencia,
        onGuardado: onGuardadoYCerrar,
        // Cuando falla el envío del email la ausencia ya se guardó, pero el
        // drawer se queda abierto con el aviso visible — no cierra solo.
        onDatosActualizados,
      }));
    } else if (modo === "ausente") {
      drawer.appendChild(buildAusenteReadonly(entry, { onReactivar }));
    } else {
      drawer.appendChild(buildClaseBody(entry, fecha, { onMarcarAusente, onGuardado: onGuardadoYCerrar }));
    }
    guard.marcarLimpio();
  }

  // `onDatosActualizados` es específico de cada apertura: quien llama a
  // open() decide qué hacer con la sesión guardada (actualizar la fila
  // correspondiente en la lista del diario), en vez de que el drawer
  // dependa de un callback fijo capturado en su creación.
  function open(entry, fecha, { onGuardado: onDatosActualizados }) {
    const estado = estadoDeEntry(entry);
    const modoInicial = estado === "ausente" ? "ausente" : "clase";
    render(entry, fecha, modoInicial, onDatosActualizados);
    overlay.classList.add("open");
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) intentarCerrarAccidental(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) intentarCerrarAccidental();
  });

  return { open, close };
}
