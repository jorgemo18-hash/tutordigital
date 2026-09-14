// LA HOJA DE EJERCICIOS — MONTAJE.
//
// Pedido por Jorge el 14/09/2026: una plantilla propia y reconocible, del
// estilo de las fichas de refuerzo que pasó (fórmula / esquema / resumen
// arriba y los ejercicios debajo), con mezcla de ejercicios y problemas,
// variedad antes que repetición y sin sacar cien ejercicios.
//
// ESTE MÓDULO NO SABE DE DÓNDE SALE EL CONTENIDO. Recibe un objeto y devuelve
// el folio. Hoy el contenido se escribe a mano (ver muestras/); mañana vendrá
// de la base de datos y lo generará un modelo. Si este archivo tuviera que
// saber cuál de las dos cosas es, habría que tocarlo cada vez.
//
// FORMA DEL CONTENIDO — y esto es, de hecho, el borrador del modelo de datos,
// porque las columnas de la tabla van a ser estos campos:
//
//   {
//     materia:  "Matemáticas",
//     curso:    "1.º ESO",
//     tema:     "Tema 3 · Números enteros",
//     objetivo: "Sumar y restar números enteros",   // el título grande
//     centro:   "IES ...",                          // opcional, va en el pie
//     codigo:   "H-260914-01",                      // ver codigoHoja.js
//     esencial: { titulo, parrafos: [], formulas: [{ tex, pie }] },
//     ejemplos: [{ enunciado, pasos: [] }],
//     actividades: [{
//       enunciado, tipo: "ejercicio" | "problema", dificultad: 1..3,
//       apartados: [], columnas: 1|2|3, lineas: 0..n
//     }]
//   }
//
// Las matemáticas van entre $...$ en cualquier texto; se dibujan al final.

import { buildCabecera } from "./cabeceraHoja.js";
import { buildEsencial } from "./bloqueEsencial.js";
import { buildEjemplos } from "./bloqueEjemplo.js";
import { buildActividades } from "./actividades.js";
import { buildPie } from "./pieHoja.js";
import { dibujarFormulas } from "./formulasDeLaHoja.js";
import { revisarAjuste } from "./ajusteDelFolio.js";

const LINK_ID = "hoja-estilos";
const HREF = "/assets/shared/hoja/styles/hoja.css";

// Idempotente: al cambiar un ejercicio la hoja se repinta, y no hace falta una
// etiqueta <link> por repintado. Mismo patrón que el cuadrante.
export function ensureEstilosDeHoja(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(LINK_ID)) return;
  const link = doc.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = HREF;
  doc.head.appendChild(link);
}

export function buildHoja(contenido = {}, { doc = globalThis.document, pantalla = true } = {}) {
  const {
    materia = "",
    curso = "",
    tema = "",
    objetivo = "",
    centro = "",
    codigo = "",
    esencial = null,
    ejemplos = [],
    actividades = [],
  } = contenido;

  const hoja = doc.createElement("article");
  hoja.className = pantalla ? "hoja hoja--pantalla" : "hoja";
  hoja.dataset.codigo = codigo;

  hoja.appendChild(buildCabecera({ materia, curso, tema, objetivo, codigo, doc }));

  if (esencial) {
    const caja = buildEsencial({ ...esencial, doc });
    if (caja) hoja.appendChild(caja);
  }

  buildEjemplos(ejemplos, doc).forEach((ej) => hoja.appendChild(ej));

  hoja.appendChild(buildActividades(actividades, doc));
  hoja.appendChild(buildPie({ centro, codigo, doc }));

  return hoja;
}

// Pintar = montar + meter en el contenedor + una pasada de KaTeX + comprobar
// que cabe en el folio. Devuelve la hoja para que quien la pinte pueda seguir
// trabajando con ella (cambiar un hueco, imprimirla) sin buscarla en el DOM.
//
// EL ORDEN IMPORTA: primero las fórmulas y después la medida. Una fórmula
// dibujada por KaTeX no ocupa lo mismo que su código en crudo, así que medir
// antes daría por bueno un folio que se sale. Y la medida es asíncrona porque
// además hay que esperar a las tipografías (ver ajusteDelFolio.js).
export function pintarHoja(contenedor, contenido, opciones = {}) {
  if (!contenedor) return null;
  const doc = opciones.doc || contenedor.ownerDocument || globalThis.document;
  ensureEstilosDeHoja(doc);

  const hoja = buildHoja(contenido, { ...opciones, doc });
  contenedor.replaceChildren(hoja);
  dibujarFormulas(hoja, opciones.win || globalThis.window);

  // Sin await: la hoja ya está en pantalla y el aviso aparece un instante
  // después, cuando se puede medir de verdad. Quien necesite el resultado
  // (un test, o el generador antes de proponer la hoja) llama a revisarAjuste.
  revisarAjuste(contenedor, hoja, { doc });

  return hoja;
}
