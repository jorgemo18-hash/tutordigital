// Escucha "ttd:statement-uploaded" (disparado por ctxFileManager al subir el
// enunciado) y relanza initSession. startSession es idempotente: si la
// sesión existente estaba "muerta" (sin adjunto en su momento, por eso sin
// pasos), detecta el adjunto ya subido y reanaliza en vez de servir el
// estado vacío para siempre. Mismo camino que usa el reintento manual del
// placeholder (ver onRetryAnalysis en onSessionReady.js).
export function installStatementUploadedHandler({ initSession, getActiveTaskMode }) {
  const handler = (ev) => {
    const taskId = ev?.detail?.taskId;
    if (!taskId || typeof initSession !== "function") return;
    try { initSession(taskId, getActiveTaskMode?.() || "deberes"); } catch {}
  };

  try { window.addEventListener("ttd:statement-uploaded", handler); } catch {}
  return function cleanup() {
    try { window.removeEventListener("ttd:statement-uploaded", handler); } catch {}
  };
}
