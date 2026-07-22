import { buildPeriodoSelector } from "./periodoSelector.js";
import { buildRegenerarBoton } from "./regenerarBoton.js";
import { elegirTipoEnvio } from "./elegirTipoEnvioDialog.js";

function buildBtn(texto, claseExtra) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  return btn;
}

function mensajeConfirmacionLote(sustantivo) {
  return ({ afectados }) =>
    `${afectados} ${sustantivo}(s) de este período ya están enviados o pagados. ` +
    `Regenerarlos creará una versión distinta a la que recibieron las familias. ¿Continuar con todos?`;
}

function textoOkLote(base) {
  return (resultado) => (resultado?.fallidos ? `${base} (${resultado.fallidos} error${resultado.fallidos > 1 ? "es" : ""})` : base);
}

// Cabecera de "Envío a familias": título + selector de período + los dos
// botones de regeneración por lote (uno para recibos, uno para informes —
// sin ambigüedad de a qué afecta cada uno) + botón enviar todos. Todas las
// dependencias (estado y callbacks) llegan explícitas — no lee nada del
// scope del orquestador.
export function buildCabecera({
  mes,
  anio,
  mesesEnviados,
  anioActualSistema,
  hayRecibosEnPeriodo,
  hayPendientes,
  onCambiarPeriodo,
  onRegenerarRecibos,
  onRegenerarInformes,
  onEnviarTodos,
  elegirTipoEnvioFn = elegirTipoEnvio,
}) {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Envío a familias";
  head.appendChild(title);

  const acciones = document.createElement("div");
  acciones.className = "ef-head-acciones";

  acciones.appendChild(buildPeriodoSelector({ mes, anio, mesesEnviados, anioActualSistema, onChange: onCambiarPeriodo }));

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  acciones.appendChild(
    buildRegenerarBoton({
      textoIdle: hayRecibosEnPeriodo ? "Regenerar recibos" : "Generar recibos",
      textoOk: textoOkLote("✓ Regenerado"),
      claseExtra: "copper",
      ejecutar: onRegenerarRecibos,
      mensajeConfirmacion: mensajeConfirmacionLote("recibo"),
      onError: (err) => { msg.textContent = err.message || "No se pudieron regenerar los recibos."; msg.className = "ac-drawer-msg error"; },
    })
  );

  acciones.appendChild(
    buildRegenerarBoton({
      textoIdle: "Regenerar informes",
      textoOk: textoOkLote("✓ Regenerado"),
      claseExtra: "copper",
      ejecutar: onRegenerarInformes,
      mensajeConfirmacion: mensajeConfirmacionLote("informe"),
      onError: (err) => { msg.textContent = err.message || "No se pudieron regenerar los informes."; msg.className = "ac-drawer-msg error"; },
    })
  );

  const enviarTodosBtn = buildBtn("Enviar todos", "primary");
  enviarTodosBtn.disabled = !hayPendientes;
  enviarTodosBtn.addEventListener("click", async () => {
    // El diálogo de tipo va ANTES y es propio de este botón — el
    // forward-only de cada envío individual del lote lo gestiona el
    // backend familia a familia (ver envioFamiliasSection.js), sin un
    // segundo diálogo aquí: las familias del lote ya están filtradas como
    // "pendientes" para el tipo elegido, así que no deberían dispararlo.
    const tipo = await elegirTipoEnvioFn();
    if (!tipo) return;
    enviarTodosBtn.disabled = true;
    try {
      await onEnviarTodos(tipo);
    } finally {
      enviarTodosBtn.disabled = false;
    }
  });
  acciones.appendChild(enviarTodosBtn);
  acciones.appendChild(msg);

  head.appendChild(acciones);
  return head;
}
