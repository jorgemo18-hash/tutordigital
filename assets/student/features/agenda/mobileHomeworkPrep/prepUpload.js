// Upload logic for mobile homework prep screen.
// Mirrors ctxFileManager._uploadCtxFile and uses the same localStorage key format
// so that ctxFileManager.restoreCtxFile can find the entries on desktop.

export function readPrepFiles(taskId) {
  try {
    const raw = localStorage.getItem(`ctxFiles_${taskId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed?.attachmentId ? [parsed] : []);
  } catch { return []; }
}

function savePrepFiles(taskId, entries) {
  const seen = new Set();
  const deduped = entries.filter(
    e => e?.attachmentId && !seen.has(e.attachmentId) && seen.add(e.attachmentId)
  );
  localStorage.setItem(`ctxFiles_${taskId}`, JSON.stringify(deduped));
}

export async function uploadPrepFile(file, taskId, apiFetch) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await apiFetch("/api/v1/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id:   taskId,
      file_name: file.name,
      mime:      file.type || "application/octet-stream",
      data:      dataUrl,
      role:      "statement",
    }),
  });

  const body = await res.json();
  const att  = body?.data;
  if (!att?.id) throw new Error("upload failed: no id returned");

  const entry = {
    attachmentId: att.id,
    file_name:    att.file_name || file.name,
    mime:         att.mime      || file.type,
  };
  savePrepFiles(taskId, [entry, ...readPrepFiles(taskId)]);
  return entry;
}
