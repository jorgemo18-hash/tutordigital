// Guarda de "cambios sin guardar" — pensada para drawers/paneles con
// campos editables (bulk-grade-drawer, grade-drawer, alumnoDrawer...) que
// hoy cierran en silencio al pinchar fuera o pulsar Escape, perdiendo lo
// que el usuario acaba de escribir. Un único punto en vez de que cada
// drawer reimplemente su propio "¿ha cambiado algo?".
//
// `getSnapshot` es una dependencia explícita (nunca cierra sobre el DOM
// del drawer que la usa): cada consumidor decide qué cuenta como "su
// estado" — un escaneo genérico de inputs (ver snapshotFormValues.js) o
// algo a medida si sus campos no son inputs de verdad. Debe devolver algo
// serializable con JSON.stringify (string, array, objeto plano...).
export function createUnsavedChangesGuard({ getSnapshot }) {
  let snapshotInicial = null;

  // Llamar tras pintar el formulario con sus valores de partida (al
  // abrir el drawer, o tras un guardado si se queda abierto) — todo lo
  // que pase a getSnapshot() después de esto se compara contra este punto.
  function marcarLimpio() {
    snapshotInicial = JSON.stringify(getSnapshot());
  }

  // false antes de marcarLimpio() (nada que comparar todavía) — evita un
  // falso "hay cambios" si algo pregunta antes de que el drawer termine
  // de abrirse.
  function tieneCambiosSinGuardar() {
    if (snapshotInicial === null) return false;
    return JSON.stringify(getSnapshot()) !== snapshotInicial;
  }

  return { marcarLimpio, tieneCambiosSinGuardar };
}
