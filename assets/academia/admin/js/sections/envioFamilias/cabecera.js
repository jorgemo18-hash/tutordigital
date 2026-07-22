import { buildPeriodoSelector } from "./periodoSelector.js";
import { buildRegenerarBoton } from "./regenerarBoton.js";
import { elegirAccion } from "./elegirAccionDialog.js";
import { opcionesLote } from "./acciones/opcionesAccion.js";

function textoOkLote(base) {
  return (resultado) => (resultado?.fallidos ? `${base} (${resultado.fallidos} error${resultado.fallidos > 1 ? "es" : ""})` : base);
}

function cancelado() {
  const err = new Error("Acción cancelada.");
  err.code = "cancelado";
  return err;
}

// Cabecera de "Envío a familias": título + selector de período + dos
// botones únicos, "Regenerar" y "Enviar" — cada uno abre un diálogo con
// las 3 opciones del lote completo (recibos+informes / solo recibos /
// solo informes, ver acciones/opcionesAccion.js) en vez de un botón
// aparte por combinación. La ejecución real (routing del tipo elegido a
// los endpoints de lote ya existentes) vive fuera, en
// envioFamiliasSection.js (onRegenerar/onEnviar) — esta cabecera solo
// pinta el diálogo y delega.
export function buildCabecera({
  mes,
  anio,
  mesesEnviados,
  anioActualSistema,
  hayPendientes,
  onCambiarPeriodo,
  onRegenerar,
  onEnviar,
  elegirAccionFn = elegirAccion,
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
      textoIdle: "Regenerar",
      textoOk: textoOkLote("✓ Regenerado"),
      claseExtra: "copper",
      ejecutar: async () => {
        const opcion = await elegirAccionFn({ titulo: "¿Qué quieres regenerar?", opciones: opcionesLote("Regenerar") });
        if (!opcion) throw cancelado();
        return onRegenerar(opcion.tipo);
      },
      onError: (err) => { msg.textContent = err.message || "No se pudo regenerar."; msg.className = "ac-drawer-msg error"; },
    })
  );

  const enviarBtn = buildRegenerarBoton({
    textoIdle: "Enviar",
    textoCargando: "Enviando…",
    textoOk: textoOkLote("✓ Enviado"),
    claseExtra: "primary",
    ejecutar: async () => {
      const opcion = await elegirAccionFn({ titulo: "¿Qué quieres enviar?", opciones: opcionesLote("Enviar") });
      if (!opcion) throw cancelado();
      return onEnviar(opcion.tipo);
    },
    onError: (err) => { msg.textContent = err.message || "No se pudo enviar."; msg.className = "ac-drawer-msg error"; },
  });
  enviarBtn.disabled = !hayPendientes;
  acciones.appendChild(enviarBtn);

  acciones.appendChild(msg);
  head.appendChild(acciones);
  return head;
}
