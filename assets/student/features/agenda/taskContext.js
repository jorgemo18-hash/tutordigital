// Shared task context store – conecta la agenda con el tutor IA
let _tasks = new Map(); // taskId → { id, title, desc }
let _activeTaskId = null;

export function setTasks(tasks = []) {
  _tasks = new Map(tasks.map((t) => [t.id, t]));
}

export function setActiveTaskId(id) {
  _activeTaskId = id ? String(id) : null;
}

export function getActiveTaskContext() {
  if (!_activeTaskId) return null;
  return _tasks.get(_activeTaskId) || null;
}
