// Shared task context store – conecta la agenda con el tutor IA
let _tasks = new Map(); // taskId → { id, title, desc }
let _activeTaskId = null;
let _ctxAttachment = null; // { id, mime, file_name } — uploaded by student for current task

export function setTasks(tasks = []) {
  _tasks = new Map(tasks.map((t) => [t.id, t]));
}

export function setActiveTaskId(id) {
  _activeTaskId = id ? String(id) : null;
}

export function getActiveTaskContext() {
  if (!_activeTaskId) return null;
  const task = _tasks.get(_activeTaskId) || null;
  if (!task) return null;
  return {
    ...task,
    subject: task.subjectName || task.subject || null,
  };
}

export function setCtxAttachment(att) {
  _ctxAttachment = att ? { ...att } : null;
}

export function getActiveTaskAttachments() {
  const task = getActiveTaskContext();
  const taskAtts = task?.attachments || [];
  if (_ctxAttachment) return [...taskAtts, _ctxAttachment];
  return taskAtts;
}
