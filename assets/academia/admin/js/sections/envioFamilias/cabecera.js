import { buildPeriodoSelector } from "./periodoSelector.js";
import { textoDelEnvio } from "../../../../../shared/js/periodosDeEnvio.js";
import { buildRegenerarBoton } from "./regenerarBoton.js";
import { elegirAccion } from "./elegirAccionDialog.js";
import { opcionesLote, opcionesRegenerarRecibos } from "./acciones/opcionesAccion.js";

const NOMBRE_MES = [null, "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "✓ Regenerado (2 errores; 5 sin clases en agosto)". Los alumnos sin clases
// el mes del informe no son errores: no tienen informe que hacer.
export function textoOkLote(base) {
  return (resultado) => {
    const partes = [];
    if (resultado?.fallidos) partes.push(`${resultado.fallidos} error${resultado.fallidos > 1 ? "es" : ""}`);
    if (resultado?.sinClases) {
      const mesInforme = NOMBRE_MES[resultado.periodoInforme?.mes] || "ese mes";
      partes.push(`${resultado.sinClases} sin clases en ${mesInforme}`);
    }
    return partes.length ? `${base} (${partes.join("; ")})` : base;
  };
}

// EL SELECTOR DICE QUÉ INFORME VA EN CADA MES (Jorge, 1/10/2026: «quiero que
// se vean los de septiembre» — elegía «Septiembre» y le salía el informe de
// agosto). En el modo del informe del mes anterior, cada opción lleva su
// informe: «Octubre · informe de septiembre». En el modo del mismo mes, null
// (el selector de siempre).
export function etiquetaDelEnvio(mes, periodoInforme) {
  if (!periodoInforme || periodoInforme.mes === mes) return null;
  return (m) => `${NOMBRE_MES[m].replace(/^./, (c) => c.toUpperCase())} · informe de ${NOMBRE_MES[m === 1 ? 12 : m - 1]}`;
}

// EL ATAJO AL INFORME DEL MES DEL ENVÍO (Jorge, 1/10/2026). Con «recibo del
// mes que empieza + informe del que acaba», quien busca los informes de
// septiembre elige septiembre… y le sale el de agosto, sin clases, y nada
// que generar. Cuando el mes del informe no tuvo ninguna clase, se dice y
// se da el camino: los de septiembre están en el envío de octubre. Con
// clases no sale: el mes del envío es el bueno y sería ruido.
export function buildAtajoAlInforme({ mes, anio, periodoInforme, informeSinClases, onCambiarPeriodo }) {
  if (!informeSinClases || !periodoInforme || (periodoInforme.mes === mes && periodoInforme.anio === anio) || !onCambiarPeriodo) return null;
  const siguiente = mes === 12 ? { mes: 1, anio: anio + 1 } : { mes: mes + 1, anio };
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ef-atajo-informe";
  btn.textContent = `En ${NOMBRE_MES[periodoInforme.mes]} no hubo clases: este envío va sin informes. Los de ${NOMBRE_MES[mes]} van en el envío de ${NOMBRE_MES[siguiente.mes]} →`;
  btn.addEventListener("click", () => onCambiarPeriodo(siguiente));
  return btn;
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
  informeSinClases = false,
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
  const atajo = buildAtajoAlInforme({ mes, anio, periodoInforme, informeSinClases, onCambiarPeriodo });
  if (atajo) titulos.appendChild(atajo);
  head.appendChild(titulos);

  const acciones = document.createElement("div");
  acciones.className = "ef-head-acciones";

  acciones.appendChild(buildPeriodoSelector({
    mes, anio, mesesEnviados, anioActualSistema, onChange: onCambiarPeriodo, etiquetaMes: etiquetaDelEnvio(mes, periodoInforme),
  }));

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
