// LAS MEDIDAS DEL CUADRANTE EN PAPEL: anchos de columna, altos de fila, cuerpo
// de letra y reparto en páginas. Ni una sola línea de dibujo.
//
// POR QUÉ ESTO ES UN ARCHIVO APARTE Y NO ESTÁ DENTRO DEL QUE DIBUJA. Porque es
// lo único que puede equivocarse de verdad —lo demás son rectángulos— y aquí
// se puede probar entero sin generar un PDF: la función que mide el texto entra
// como parámetro.
//
// Y POR QUÉ SE MIDE AQUÍ Y NO EN EL NAVEGADOR, que es de donde venimos: en el
// navegador el folio no es nuestro. Safari ignora `@page` —ni tamaño ni
// márgenes—, los pone la impresora, y encima la escala del diálogo cambia la
// geometría DESPUÉS de haber medido. Es un cálculo a ciegas sobre un papel que
// no se ve, y por eso salían dos y tres folios. Aquí el folio está escrito en
// puntos, lo medimos con las métricas reales de la tipografía que vamos a
// imprimir, y sale igual en cualquier impresora y en cualquier navegador.

// De mayor a menor. Se coge el primero que cabe entero en una página.
export const CUERPOS_PT = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6];

export const PADDING_CELDA = 4;
export const ALTO_MINIMO_FILA = 18;

// La columna de la hora no se reparte con las demás: mide lo que mide
// "15:30–16:30" y ni un punto más. Todo lo que le sobre se lo quedan los
// nombres, que es lo que hay que leer.
export function anchoDeColumnas({ anchoTotal, columnas, anchoHora }) {
  const restante = Math.max(0, anchoTotal - anchoHora);
  const porDia = columnas.length ? restante / columnas.length : 0;
  return { hora: anchoHora, dia: porDia };
}

// El alto de una fila: el de la casilla más alta, con su aire, y nunca por
// debajo del mínimo (una fila vacía de una hora sin clases tiene que seguir
// pareciendo una fila).
export function altoDeFila(fila, { anchos, cuerpo, medirTexto, padding = PADDING_CELDA }) {
  const altos = (fila.celdas || []).map((texto) =>
    texto ? medirTexto(texto, anchos.dia - padding * 2, cuerpo) : 0
  );
  const altoHora = medirTexto(fila.hora, anchos.hora - padding * 2, cuerpo);
  const contenido = Math.max(altoHora, ...altos, 0);
  return Math.max(ALTO_MINIMO_FILA, contenido + padding * 2);
}

export function altoDeCabecera({ columnas, anchos, cuerpo, medirTexto, padding = PADDING_CELDA }) {
  const altos = columnas.map((c) => medirTexto(c.name, anchos.dia - padding * 2, cuerpo));
  return Math.max(ALTO_MINIMO_FILA, Math.max(...altos, 0) + padding * 2);
}

// El alto de la tabla entera con un cuerpo de letra dado.
export function altoDeTabla({ columnas, filas, anchos, cuerpo, medirTexto }) {
  const cabecera = altoDeCabecera({ columnas, anchos, cuerpo, medirTexto });
  const cuerpoTabla = filas.reduce(
    (total, fila) => total + altoDeFila(fila, { anchos, cuerpo, medirTexto }),
    0
  );
  return cabecera + cuerpoTabla;
}

// El cuerpo de letra MÁS GRANDE con el que el cuadrante entero cabe en una
// página. Se agranda la letra, no se estiran las filas: estirarlas deja
// casillas enormes con el texto minúsculo pegado arriba, que parece un error
// de maquetación y no un cuadrante.
//
// Si no cabe ni con el más pequeño (un centro con doce franjas y seis días),
// se devuelve el mínimo y la tabla continúa en la página siguiente repitiendo
// la cabecera — ver repartirEnPaginas. Nunca se recorta nada.
export function elegirCuerpo({ columnas, filas, anchoTotal, anchoHoraPorCuerpo, altoDisponible, medirTexto, cuerpos = CUERPOS_PT }) {
  for (const cuerpo of cuerpos) {
    const anchos = anchoDeColumnas({ anchoTotal, columnas, anchoHora: anchoHoraPorCuerpo(cuerpo) });
    if (altoDeTabla({ columnas, filas, anchos, cuerpo, medirTexto }) <= altoDisponible) {
      return { cuerpo, anchos };
    }
  }
  const ultimo = cuerpos[cuerpos.length - 1];
  return { cuerpo: ultimo, anchos: anchoDeColumnas({ anchoTotal, columnas, anchoHora: anchoHoraPorCuerpo(ultimo) }) };
}

// Reparte las filas en páginas. La cabecera se repite en cada una: una segunda
// hoja sin los días arriba no se puede leer sin la primera al lado.
//
// UNA FILA NO SE PARTE NUNCA entre dos páginas. Media hora a caballo de dos
// folios es media hora que nadie lee.
export function repartirEnPaginas({ columnas, filas, anchos, cuerpo, altoDisponible, medirTexto }) {
  const alturas = filas.map((fila) => altoDeFila(fila, { anchos, cuerpo, medirTexto }));
  const cabecera = altoDeCabecera({ columnas, anchos, cuerpo, medirTexto });

  const paginas = [];
  let actual = [];
  let alto = cabecera;

  filas.forEach((fila, i) => {
    // `actual.length` en la condición: una fila más alta que la página entera
    // (imposible en la práctica, pero) se queda sola en la suya en vez de
    // provocar páginas vacías infinitas.
    if (actual.length && alto + alturas[i] > altoDisponible) {
      paginas.push(actual);
      actual = [];
      alto = cabecera;
    }
    actual.push({ ...fila, alto: alturas[i] });
    alto += alturas[i];
  });

  if (actual.length) paginas.push(actual);
  return { paginas, altoCabecera: cabecera };
}
