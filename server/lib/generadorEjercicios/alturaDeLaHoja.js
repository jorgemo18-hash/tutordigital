// ¿CUÁNTOS FOLIOS OCUPA UNA HOJA QUE TODAVÍA NO EXISTE?
//
// El montador tiene que decidir cuántas baterías entran ANTES de pintar nada,
// y corre en Node, donde no hay maquetación. Hasta ahora decidía por NÚMERO
// de actividades, y eso se vio mal en el papel dos veces: una hoja de refuerzo
// del objetivo 3 dejaba 35 mm en blanco, y una del objetivo 6 sacaba un
// segundo folio con solo el pie.
//
// Aquí se suman MILÍMETROS MEDIDOS (ver `alturasMedidas.js`, que lo escribe
// el script de calibración midiendo la hoja en Chromium) y se simulan los
// saltos de página con la MISMA función que usa la vista previa.
//
// SE IMPORTA `repartirEnFolios` DE assets/, y es a propósito. La regla del
// salto de página —una actividad no se parte, la que no cabe abajo se va
// entera a la página siguiente— ya está escrita y probada ahí. Copiarla aquí
// serían dos implementaciones de la misma regla divergiendo en silencio, que
// es exactamente el tipo de fallo que este archivo viene a arreglar.
//
// ESTO ES UNA ESTIMACIÓN Y SE DICE ASÍ. Las alturas son el máximo de ocho
// semillas, o sea una cota superior: una hoja real suele ocupar algo menos.
// La medida de verdad solo se puede hacer con la hoja pintada, y la hace
// `ajusteDelFolio.js` en la vista previa. Aquí se decide con lo que se sabe,
// y se peca de corto antes que de largo — un folio de más es papel gastado.

import { repartirEnFolios } from "../../../assets/shared/hoja/js/paginacionDeLaHoja.js";
import { MINIMO_ULTIMO_FOLIO_MM } from "../../../assets/shared/hoja/js/ajusteDelFolio.js";
import {
  ALTO_UTIL_POR_FOLIO_MM,
  ALTURA_DEL_TITULO_DE_BLOQUE_MM,
  ALTURA_DE_LA_CABECERA_MM,
  ALTURA_DEL_PIE_MM,
  ALTURA_DE_LA_BATERIA_MM,
} from "./alturasMedidas.js";

// Se reexportan los dos umbrales para que el montador tenga UN sitio del que
// tirar: el mínimo de folio aprovechado es el mismo número con el que la
// vista previa avisa en rojo, y tenerlo escrito dos veces significaría que el
// montador puede montar hojas que el aviso llama malas.
export { ALTO_UTIL_POR_FOLIO_MM, MINIMO_ULTIMO_FOLIO_MM };

// Cuánto ocupa una batería con sus apartados y, si lo lleva, su título de
// bloque. Una batería sin medir NO se estima por lo bajo: se le da el mayor
// alto de la tabla, para que una batería nueva sin calibrar deje la hoja
// corta en vez de salirse de folio. El test que exige que todas estén
// medidas es el que hace que esto no pase de red de seguridad.
const MAS_ALTA_MEDIDA = Math.max(
  ...Object.values(ALTURA_DE_LA_BATERIA_MM).flatMap((x) => Object.values(x)),
);

export function alturaDeBateriaMm(clave, modo, { conTitulo = false } = {}) {
  const medida = ALTURA_DE_LA_BATERIA_MM[clave]?.[modo] ?? MAS_ALTA_MEDIDA;
  return medida + (conTitulo ? ALTURA_DEL_TITULO_DE_BLOQUE_MM : 0);
}

// UNA HOLGURA, PORQUE LA COTA NO ES COTA. Las alturas medidas son el máximo
// de doce semillas, pero una semilla trece puede sacar una expresión más
// larga que parta línea. Pasó el 23/9 con el barrido impreso: dos hojas
// estimadas en 273 mm de 275 imprimieron un segundo folio con solo el pie,
// que es el peor resultado posible (papel gastado para nada). Una línea de
// holgura cuesta, como mucho, una batería menos en una hoja que iba justa.
export const HOLGURA_MM = 6;

// El reparto en folios de una lista de alturas ya calculadas.
//
// `cabecera` solo ocupa sitio en el primer folio; el pie va al final del
// flujo y puede abrir folio él solo (probado: Chrome no deja fijarlo al
// margen — ver el comentario de `.hj-foot` en hoja.css), así que cuenta como
// una pieza más.
export function foliosEstimados(alturasMm, { conCabecera = true } = {}) {
  const { folios, usadoUltimoPx } = repartirEnFolios({
    utilPx: ALTO_UTIL_POR_FOLIO_MM - HOLGURA_MM,
    cabeceraPx: conCabecera ? ALTURA_DE_LA_CABECERA_MM : 0,
    actividadesPx: alturasMm,
    piePx: ALTURA_DEL_PIE_MM,
  });
  return { folios, usadoUltimoMm: Math.round(usadoUltimoPx * 10) / 10 };
}

// Las alturas de una lista de baterías tal como se van a imprimir: cada una
// con sus apartados, y con título de bloque la primera de cada objetivo.
//
// LOS TÍTULOS DE BLOQUE CUENTAN, y no es un detalle: son casi 10 mm cada uno.
// La hoja del objetivo 6 en modo normal cabía en un folio y se fue a dos el
// día que se añadieron los títulos, justo por esto.
//
// La condición de cuándo hay títulos tiene que ser la MISMA que la del
// montador al pintarlos (con un solo objetivo no se titula nada): si aquí se
// contaran y allí no se pintaran, la hoja saldría corta siempre.
export function alturasDe(baterias, modo) {
  const hayVariosObjetivos = new Set(baterias.map((b) => b.objetivo)).size > 1;
  let objetivoAnterior = null;
  return baterias.map((bateria) => {
    const conTitulo = hayVariosObjetivos && bateria.objetivo !== objetivoAnterior;
    objetivoAnterior = bateria.objetivo;
    return alturaDeBateriaMm(bateria.clave, modo, { conTitulo });
  });
}
