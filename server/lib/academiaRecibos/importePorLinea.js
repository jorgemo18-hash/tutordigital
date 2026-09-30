import { round2 } from "./calculos.js";

// LO QUE PAGA CADA ALUMNO DENTRO DEL RECIBO DE SU FAMILIA. Cálculo puro.
//
// EL PROBLEMA (Jorge, 30/09/2026): *"si en una factura le doy el 50 % de
// descuento, en finanzas me sigue apareciendo todo"*. Finanzas › Ingresos
// ponía a cada alumno su TARIFA, no lo que dice su recibo. En septiembre de
// 2026 los 15 recibos cobrados sumaban 1.099,25 € y la pantalla enseñaba
// 1.635 €: el descuento puntual, los recurrentes y los de tarifa no
// existían para ella.
//
// LA REGLA: el dinero que se enseña sale del RECIBO. La tarifa solo sirve
// para crearlo.
//
// El recibo es por familia, pero la pantalla va por alumno, así que el
// neto se reparte:
//   - lo que es de cada alumno (su bruto menos sus descuentos de línea:
//     tarifa y recurrentes) es suyo;
//   - lo que el recibo descuenta a la familia entera (el puntual, y el de
//     hermanos de los recibos antiguos) se reparte en proporción al bruto;
//   - el céntimo del redondeo se lo queda la última línea, para que la suma
//     de las líneas sea EXACTAMENTE el total_neto del recibo. Dos cifras
//     del mismo recibo que difieren en un céntimo son justo lo que hace que
//     se deje de mirar una pantalla.
//
// El descuento "de familia" no se recalcula con porcentajes: se deduce del
// propio recibo (bruto − neto − lo de las líneas). Así vale para cualquier
// combinación que haya guardado el recibo, también las de versiones viejas.
export function importesPorLinea(recibo = {}, lineas = []) {
  if (!lineas.length) return [];
  const brutoLinea = (l) => Number(l.precio_bruto) || 0;
  const deLinea = (l) => (l.descuentos_recurrentes || []).reduce((s, d) => s + (Number(d.importe) || 0), 0);

  const totalBrutoLineas = lineas.reduce((s, l) => s + brutoLinea(l), 0);
  const totalNeto = Number(recibo.total_neto) || 0;
  const propios = lineas.map((l) => round2(brutoLinea(l) - deLinea(l)));
  const deFamilia = round2(propios.reduce((s, x) => s + x, 0) - totalNeto);

  const importes = propios.map((propio, i) => {
    const parte = totalBrutoLineas > 0 ? (deFamilia * brutoLinea(lineas[i])) / totalBrutoLineas : deFamilia / lineas.length;
    return round2(propio - parte);
  });
  const desfase = round2(totalNeto - importes.reduce((s, x) => s + x, 0));
  importes[importes.length - 1] = round2(importes[importes.length - 1] + desfase);
  return importes;
}
