// UN 0,00 € QUE ES UN HUECO, NO UNA CIFRA.
//
// EL PROBLEMA (barrido del 12/09/2026). Las tres tarjetas de la pestaña Gastos
// —Total, IVA soportado, Ticket medio— ponen `0,00 €` cuando el período no
// tiene ni un gasto metido. Tres ceros con pinta de dato, y debajo un reparto
// por categoría vacío y una tabla vacía: la pantalla no dice en ningún sitio
// que lo que falta no es el cálculo, es la entrada.
//
// ES EL MISMO PATRÓN QUE COSTÓ MEDIA HORA EL 12/09, cuando "Ingresos: 0,00 €"
// llevó a buscar un fallo de sincronización que no existía. Una pantalla de
// dinero que dice 0 € sin decir que está vacía no informa: miente por omisión.
//
// JORGE TIENE RAZÓN EN QUE METER LOS GASTOS ES SUYO, no de la aplicación — el
// arreglo no es inventarse datos, es que la pantalla lo diga. Y el aviso no
// desaparece cuando él los meta: lo verá cualquier período sin gastos (enero
// que viene, un año que se consulte de más) y, sobre todo, lo verá una academia
// nueva su primer día, que es de lo que va la Vía 2.
//
// Y TIENE CONSECUENCIA FISCAL, que es lo que lo saca de "detalle estético": de
// estos gastos sale la casilla de gastos deducibles del Modelo 130. Sin
// ninguno metido, el modelo se calcula con 0 € deducibles — comprobado en
// producción el 12/09: 6 gastos en toda la base, todos de septiembre y octubre
// de 2025, ninguno de 2026.

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function etiquetaPeriodo({ modo, mes, anio, trimestre } = {}) {
  if (modo === "trimestre") return `el ${trimestre}.º trimestre de ${anio}`;
  const nombre = NOMBRE_MES[(Number(mes) || 1) - 1] || "";
  return `${nombre} de ${anio}`;
}

// DOS MENSAJES DISTINTOS, porque son dos situaciones distintas y la segunda es
// la que nadie se espera:
//
//  - Sin ningún gasto: los ceros son un hueco. Se dice, y se dice qué implica.
//  - Con gastos pero SIN NINGÚN desglose de IVA: el IVA soportado sale 0,00 €
//    teniendo gastos, que parece un fallo de cálculo y no lo es. Es la
//    situación real de Lyceo (los 6 gastos de 2025 están así), y cambia lo que
//    se deduce: sin desglose se deduce el importe ENTERO; con desglose, la base.
export function textoSinGastos({ gastos = [], resumen = {}, modo, mes, anio, trimestre } = {}) {
  const cuando = etiquetaPeriodo({ modo, mes, anio, trimestre });

  if (!gastos.length) {
    return {
      tono: "sin_gastos",
      texto:
        `No hay ningún gasto registrado en ${cuando}: esos 0,00 € son un hueco, no una cifra. ` +
        `Mientras estén vacíos, el Modelo 130 de este período calcula con 0 € de gastos deducibles.`,
    };
  }

  const sinDesglose = Number(resumen.iva_soportado || 0) === 0;
  if (sinDesglose) {
    return {
      tono: "sin_iva",
      texto:
        `Hay ${gastos.length === 1 ? "un gasto" : `${gastos.length} gastos`} en ${cuando}, pero ` +
        `ninguno con el IVA desglosado: por eso el IVA soportado sale 0,00 €. ` +
        `Sin desglose se deduce el importe entero de cada gasto, no la base.`,
    };
  }

  return null;
}

// Se reutilizan las clases del aviso de "Por emitir" (`ac-aviso-mes`), que ya
// están escritas y probadas en los dos temas. Inventar una clase nueva para
// esto habría sido otra clase sin regla, que es justo la deuda que se cerró
// esta misma mañana con `.ac-slots`.
//
// El caso SIN NINGÚN GASTO lleva el estilo de alerta y no el suave: es el que
// tiene consecuencia en un papel que se presenta.
export function buildAvisoSinGastos(datos = {}) {
  const info = textoSinGastos(datos);
  if (!info) return null;

  const p = document.createElement("p");
  p.className = info.tono === "sin_gastos" ? "ac-aviso-mes ac-aviso-mes--alerta" : "ac-aviso-mes";
  p.setAttribute("role", "status");
  p.textContent = info.texto;
  return p;
}
