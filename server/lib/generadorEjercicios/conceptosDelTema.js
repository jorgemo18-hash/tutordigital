import { temaPorId } from "./temasConGenerador.js";

// LOS NOMBRES DE LOS CONCEPTOS DEL TEMA, para enseñárselos al profesor.
//
// La pantalla de hojas del profesor (diseño de Claude Design, 23/9) dice en
// cada ejercicio qué concepto trabaja ("Resta como suma del opuesto"): es lo
// que le permite ver de un vistazo si la hoja cubre lo que quiere. Cada
// batería lleva el NÚMERO del concepto; su nombre y su saber básico (A.2,
// A.3…, notación del anexo de Aragón, ORDEN ECD/1172/2022) están en el
// archivo del tema (temas/), copiados LITERAL de su migración. Un test
// comprueba que siguen siendo los de la base de datos.
//
// Por tema, porque el número solo tiene sentido dentro de su tema.
export function nombreDelConcepto(temaId, numero) {
  return temaPorId(temaId)?.conceptos?.[numero] || null;
}

export function saberDelConcepto(temaId, numero) {
  return temaPorId(temaId)?.saberes?.[numero] || null;
}
