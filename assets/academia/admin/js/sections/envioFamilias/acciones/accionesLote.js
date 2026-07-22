import { confirmarYEjecutar } from "../confirmarYEjecutar.js";

export function mensajeConfirmacionLote(sustantivo) {
  return ({ afectados }) =>
    `${afectados} ${sustantivo}(s) de este período ya están enviados o pagados. ` +
    `Regenerarlos creará una versión distinta a la que recibieron las familias. ¿Continuar con todos?`;
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
export async function regenerarLote(tipo, {
  mes, anio, hayRecibosEnPeriodo,
  regenerarRecibosFn, generarRecibosFn, regenerarInformesFn,
  confirmFn,
}) {
  let fallidosRecibos = 0;
  let fallidosInformes = 0;

  if (tipo !== "solo_informe") {
    const resultado = await confirmarYEjecutar(
      (confirmar) => (hayRecibosEnPeriodo ? regenerarRecibosFn({ mes, anio, confirmar }) : generarRecibosFn({ mes, anio })),
      { mensajeConfirmacion: mensajeConfirmacionLote("recibo"), confirmFn }
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
