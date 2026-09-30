import { buildPeriodoSelector } from "./periodoSelector.js";
import { textoDelEnvio } from "../../../../../shared/js/periodosDeEnvio.js";
import { buildRegenerarBoton } from "./regenerarBoton.js";
import { elegirAccion } from "./elegirAccionDialog.js";
import { opcionesLote, opcionesRegenerarRecibos } from "./acciones/opcionesAccion.js";

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
  periodoInforme = null,
  mesesEnviados,
  anioActualSistema,
  hayPendientes,
  resumenRecibos = {},
  onCambiarPeriodo,
  onRegenerar,
  onEnviar,
  elegirAccionFn = elegirAccion,
}) {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const titulos = document.createElement("div");
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Envío a familias";
  titulos.appendChild(title);
  // Qué va en el correo, dicho con palabras: con el modo "informe del mes
  // anterior" el selector dice octubre y el informe es de septiembre, y
  // eso no puede quedar para que lo adivine nadie.
  const queSeEnvia = document.createElement("p");
  queSeEnvia.className = "ef-que-se-envia";
  queSeEnvia.textContent = textoDelEnvio({ mes, anio }, periodoInforme);
  titulos.appendChild(queSeEnvia);
  head.appendChild(titulos);

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
        // Con recibos de por medio, SIEMPRE se pregunta cuáles: por defecto,
        // crear los que faltan sin tocar nada (24/09/2026).
        let modo = null;
        if (opcion.tipo !== "solo_informe") {
          const elegido = await elegirAccionFn({ titulo: "¿Qué recibos?", opciones: opcionesRegenerarRecibos(resumenRecibos) });
          if (!elegido) throw cancelado();
          modo = elegido.modo;
        }
        return onRegenerar(opcion.tipo, modo);
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
