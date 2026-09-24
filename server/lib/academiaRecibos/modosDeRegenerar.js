// QUÉ RECIBOS DEL MES SE REHACEN AL PULSAR "REGENERAR".
//
// EL PROBLEMA (Jorge, 24/09/2026): con el aviso de Finanzas *"N familias se
// han quedado sin recibo"* delante, le dio a Regenerar para que salieran esas
// familias. Regenerar borraba TODOS los recibos del mes y los volvía a crear:
// 28 recibos, de los que muchos ya estaban enviados y marcados como pagados.
// Los descuentos puntuales y los números se conservaron, pero las marcas de
// pago y de envío no, y Finanzas pasó a decir que no había pagado nadie.
//
// Había una confirmación ("N ya están enviados o pagados… ¿Continuar con
// todos?"), y no sirvió: era un sí/no que no decía QUÉ se perdía y no ofrecía
// la salida segura, que era justo lo que él quería (crear los que faltaban).
//
// AHORA SON TRES MODOS, del más seguro al más destructivo:
//   faltan     crea el recibo de las familias que no tienen. No borra nada.
//   borradores rehace los que aún no se han enviado y crea los que faltan.
//              Los enviados y pagados no se tocan.
//   todos      rehace también los enviados y pagados. Exige confirmar, y aun
//              así CONSERVA el pago (una familia que pagó, pagó: eso no
//              depende de qué versión del papel tenga). Los enviados vuelven
//              a "sin enviar": la familia tiene una versión distinta.
//
// Sin modo, "borradores": un cliente antiguo que no sepa de modos no puede
// volver a borrar lo enviado por no mandarlo.
export const MODOS_REGENERAR = ["faltan", "borradores", "todos"];
export const MODO_POR_DEFECTO = "borradores";

export function planDeRegenerar(previos, modo = MODO_POR_DEFECTO, { confirmar = false } = {}) {
  const lista = previos || [];
  const enviados = lista.filter((r) => r.estado === "enviado").length;
  const pagados = lista.filter((r) => r.estado === "pagado").length;

  if (modo === "faltan") return { aBorrar: [], requiereConfirmacion: false, enviados, pagados };
  if (modo === "todos") {
    const protegidos = enviados + pagados;
    if (protegidos && !confirmar) return { aBorrar: [], requiereConfirmacion: true, afectados: protegidos, enviados, pagados };
    return { aBorrar: lista, requiereConfirmacion: false, enviados, pagados };
  }
  return { aBorrar: lista.filter((r) => r.estado === "borrador"), requiereConfirmacion: false, enviados, pagados };
}

// Lo que el recibo nuevo hereda del que se borra: el número y el descuento
// puntual (como antes) y, si estaba pagado, la fecha de pago.
export function previoParaHeredar(recibo) {
  return {
    numero_recibo: recibo.numero_recibo || null,
    descuento_puntual_pct: recibo.descuento_puntual_pct,
    descuento_puntual_nota: recibo.descuento_puntual_nota,
    fecha_pago: recibo.estado === "pagado" ? (recibo.fecha_pago || null) : null,
    pagado: recibo.estado === "pagado",
  };
}
