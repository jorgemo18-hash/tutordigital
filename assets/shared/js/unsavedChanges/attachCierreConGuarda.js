// Envuelve una función de cierre para que compruebe antes si hay cambios
// sin guardar (ver unsavedChangesGuard.js): si los hay, pide confirmación
// en vez de cerrar en silencio — mismo patrón que ya usan las acciones
// destructivas del proyecto (revocar/archivar/eliminar vía window.confirm
// inyectable, ver confirmFn en sustitucionesSection.js) en vez de montar
// un modal de confirmación nuevo solo para esto.
//
// No engancha overlay/Escape por sí solo — cada drawer ya tiene sus
// propios listeners (con matices distintos: modo "stacked", cascada de
// niveles anidados...); esto solo sustituye la llamada directa a
// cerrarFn() en esos listeners por intentarCerrar().
// intentarCerrar() devuelve true si de verdad cerró (o no había nada que
// guardar) y false si el usuario canceló — un drawer padre que engloba a
// este (p.ej. task-picker-drawer sobre bulk-grade-drawer, ver docs/
// drawer-stacking.md) necesita saber si debe seguir cerrándose él mismo o
// parar ahí, en vez de cerrar a ciegas un hijo con cambios sin guardar.
export function attachCierreConGuarda({
  guard,
  cerrarFn,
  confirmFn = (mensaje) => window.confirm(mensaje),
  mensaje = "Tienes cambios sin guardar. ¿Salir de todos modos?",
}) {
  return function intentarCerrar() {
    if (guard.tieneCambiosSinGuardar() && !confirmFn(mensaje)) return false;
    cerrarFn();
    return true;
  };
}
