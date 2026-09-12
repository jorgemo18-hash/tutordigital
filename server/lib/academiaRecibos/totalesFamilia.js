import {
  calcularDescuento, desglosarDescuentosRecurrentes, descuentoDeTarifa, intervaloAplica, round2,
} from "./calculos.js";

// LO QUE SE LE VA A COBRAR A UNA FAMILIA ESTE MES. Cálculo puro: ni lee ni
// escribe en la base de datos.
//
// POR QUÉ EXISTE (12/09/2026). Este cálculo vivía DENTRO de
// `generarReciboParaFamilia`, en las líneas de antes del insert. Se ha
// extraído porque ahora tiene dos consumidores:
//
//   1. generar/regenerar, que emite el recibo de verdad;
//   2. la previsión de "Por emitir" en Finanzas › Ingresos, que dice lo que
//      está por cobrar SIN escribir nada.
//
// Y tiene que ser LA MISMA función, no una copia. Una pantalla que promete
// 2.415 € y un lote que emite 2.200 € es peor que no tener la pantalla: la
// segunda vez que los números no cuadren, ya no se mira ninguno de los dos.
// Por eso no se recalcula "parecido" en el frontend con el bruto y el
// descuento de tarifa: eso ignoraría los descuentos recurrentes y el importe
// saldría más alto que el recibo real.
//
// `descuentosPorAlumno` (alumno_id -> [{concepto, porcentaje, acumulable,
// intervalo}]) trae los descuentos recurrentes ACTIVOS. El filtro por
// intervalo contra la fecha_alta se hace aquí, alumno a alumno, porque cada
// uno puede tener una fecha_alta y unos descuentos distintos.
//
// `descuentoPuntualPct` es el ajuste manual de un recibo concreto. En una
// previsión es 0: todavía no hay recibo donde alguien lo haya escrito.
export function calcularTotalesFamilia({
  alumnosActivos = [], descuentosPorAlumno = {}, mes, anio, descuentoPuntualPct = 0,
} = {}) {
  let totalBruto = 0;
  let recurrenteImporteTotal = 0;
  // El desglose por alumno (concepto, % e importe de cada descuento) se
  // guarda en la línea de cada uno para que la vista previa y el email
  // puedan mostrar una fila por descuento aplicado, con su importe.
  const desglosePorAlumno = {};

  for (const a of alumnosActivos) {
    const bruto = Number(a.precio_bruto || 0);
    const recurrentesQueAplican = (descuentosPorAlumno[a.id] || []).filter((d) =>
      intervaloAplica(d.intervalo, { fechaAlta: a.fecha_alta, mes, anio })
    );
    // El descuento propio de la tarifa va PRIMERO y siempre: no compite con
    // los acumulables del catálogo, es parte del precio pactado con esa
    // familia (ver descuentoDeTarifa en calculos.js).
    const deTarifa = descuentoDeTarifa(bruto, a.descuento_tarifa_pct);
    const desglose = [
      ...(deTarifa ? [deTarifa] : []),
      ...desglosarDescuentosRecurrentes(recurrentesQueAplican, bruto),
    ];
    desglosePorAlumno[a.id] = desglose;
    totalBruto += bruto;
    recurrenteImporteTotal += desglose.reduce((suma, d) => suma + d.importe, 0);
  }

  recurrenteImporteTotal = round2(recurrenteImporteTotal);
  const { totalDescuento, totalNeto } = calcularDescuento({
    totalBruto,
    descuentoPuntualPct,
    descuentoRecurrenteImporte: recurrenteImporteTotal,
  });

  return { totalBruto, totalDescuento, totalNeto, desglosePorAlumno };
}
