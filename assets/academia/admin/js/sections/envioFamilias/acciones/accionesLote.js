import { confirmarYEjecutar } from "../confirmarYEjecutar.js";

export function mensajeConfirmacionLote(sustantivo) {
  return ({ afectados }) =>
    `${afectados} ${sustantivo}(s) de este período ya están enviados o pagados. ` +
    `Regenerarlos creará una versión distinta a la que recibieron las familias. ¿Continuar con todos?`;
}

// El segundo aviso de "Rehacer todos": dice qué pasa con los enviados y con
// los pagados por separado, que es lo que no decía el de antes (24/09/2026).
export function mensajeConfirmacionRecibosTodos({ afectados = 0, enviados = 0, pagados = 0 } = {}) {
  const partes = [];
  if (enviados) partes.push(`${enviados} enviado(s) volverán a «Sin enviar» y habrá que reenviarlos`);
  if (pagados) partes.push(`${pagados} pagado(s) se rehacen pero siguen marcados como pagados`);
  return `Vas a rehacer ${afectados} recibo(s) que las familias ya tienen: ${partes.join("; ")}. ` +
    "Si solo querías crear los que faltan, cancela y elige «Crear solo los que faltan». ¿Rehacerlos todos?";
}

// Orquesta el botón "Regenerar" de la cabecera (nivel mes): según el tipo
// elegido en el diálogo, regenera recibos, informes, o ambos — reutilizando
// los endpoints de lote YA existentes (regenerarRecibosFn/
// regenerarInformesFn), cada uno con su propio ciclo de confirmación
// forward-only (independiente: si "completo" afecta a ambos, se preguntan
// uno tras otro, nunca en un único diálogo combinado — más simple y
// reutiliza tal cual la confirmación agregada que cada endpoint ya
// calcula server-side). Recibos primero, informes después: si el admin
// cancela el aviso de recibos, los informes ni se intentan.
// `modo` (recibos): faltan | borradores | todos, ver opcionesRegenerarRecibos.
// "faltan" solo crea: va a generarRecibosFn y no puede borrar nada.
export async function regenerarLote(tipo, {
  mes, anio, hayRecibosEnPeriodo, modo = "borradores",
  regenerarRecibosFn, generarRecibosFn, regenerarInformesFn,
  confirmFn,
}) {
  let fallidosRecibos = 0;
  let fallidosInformes = 0;

  if (tipo !== "solo_informe") {
    const soloCrear = modo === "faltan" || !hayRecibosEnPeriodo;
    const resultado = await confirmarYEjecutar(
      (confirmar) => (soloCrear ? generarRecibosFn({ mes, anio }) : regenerarRecibosFn({ mes, anio, confirmar, modo })),
      { mensajeConfirmacion: mensajeConfirmacionRecibosTodos, confirmFn }
    );
    fallidosRecibos = resultado?.fallidos || 0;
  }

  if (tipo !== "solo_recibo") {
    const resultado = await confirmarYEjecutar(
      (confirmar) => regenerarInformesFn({ mes, anio, confirmar }),
      { mensajeConfirmacion: mensajeConfirmacionLote("informe"), confirmFn }
    );
    fallidosInformes = resultado?.fallidos || 0;
  }

  return { fallidos: fallidosRecibos + fallidosInformes };
}
