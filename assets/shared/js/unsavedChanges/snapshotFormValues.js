// Adaptador genérico de getSnapshot() para createUnsavedChangesGuard —
// sirve para el caso común de un drawer con inputs/textareas/selects de
// verdad en el DOM (la mayoría): escanea `rootEl` y devuelve sus valores,
// así el drawer no necesita escribir su propia función de snapshot.
//
// La clave de cada campo es, en orden de preferencia, su `name`, `id` o
// `data-student-id` (bulk-grade-drawer identifica filas así) — con índice
// de respaldo si no tiene ninguno, para que añadir o quitar un campo
// (p.ej. un bloque de asignatura nuevo) también cuente como cambio, no
// solo editar uno ya existente.
export function snapshotFormValues(rootEl) {
  if (!rootEl) return [];
  const campos = rootEl.querySelectorAll("input, textarea, select");
  return [...campos].map((el, index) => {
    const key = el.name || el.id || el.dataset?.studentId || `campo-${index}`;
    const valor = el.type === "checkbox" || el.type === "radio" ? el.checked : el.value;
    return [key, valor];
  });
}
