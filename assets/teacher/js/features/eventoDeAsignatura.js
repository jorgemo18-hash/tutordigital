// "HA CAMBIADO LA ASIGNATURA DEL PROFESOR": un aviso en el documento para
// quien lo necesite sin que subjects.js tenga que saber quién es.
//
// Lo escucha Recursos (js/recursos/avisoDeAsignatura.js): un profesor de
// Música no debería ver hojas de Matemáticas sin que se le diga por qué
// (Jorge, 23/9).
export const EVENTO_ASIGNATURA = "ttd:asignatura";

export function avisarCambioDeAsignatura(nombre, doc = globalThis.document) {
  doc?.dispatchEvent?.(new doc.defaultView.CustomEvent(EVENTO_ASIGNATURA, { detail: { nombre: nombre || "" } }));
}
