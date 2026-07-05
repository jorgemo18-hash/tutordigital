// Estado compartido entre studentAgendaTeacherTasks.js (escribe) y
// onFinished.js (lee/muta) — sustituye el bus window._tdGroups /
// window._tdRefreshTasks. getTaskGroups() devuelve la MISMA referencia que
// guardó setTaskGroups(): onFinished.js muta sus arrays en el sitio
// (reasigna .work/.atrasadas tras un filter) y ese cambio debe verse aquí
// sin necesidad de un round-trip.
let _groups = null;
let _refreshFn = null;

export function setTaskGroups(groups) {
  _groups = groups;
}

export function getTaskGroups() {
  return _groups;
}

export function setRefreshTaskList(fn) {
  _refreshFn = fn;
}

export function refreshTaskList() {
  return _refreshFn?.();
}
