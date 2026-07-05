// Store del array de memberships del usuario autenticado — mismo patrón que
// assets/student/features/agenda/taskContext.js. El resto de módulos de
// home/ leen/escriben aquí en vez de cerrar sobre una variable compartida.
let _memberships = [];

export function setMemberships(list) {
  _memberships = Array.isArray(list) ? list : [];
}

export function getMemberships() {
  return _memberships;
}
