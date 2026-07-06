// Helpers de tasks.routes.js — extraídos para no superar las 400 líneas al
// añadir la verificación de tenant en group_id/task_id.
export async function getStudentForUser(admin, tenantId, userId) {
  const { data } = await admin
    .from("students")
    .select("id, group_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export async function attachAttachments(admin, tenantId, tasks = []) {
  if (!tasks.length) return tasks;
  const ids = tasks.map((t) => t.id);
  const { data } = await admin
    .from("attachments")
    .select("id, owner_id, uploader_id, file_name, mime, size, storage_path, created_at")
    .eq("tenant_id", tenantId)
    .eq("owner_type", "task")
    .in("owner_id", ids);

  // Build a map from task id → teacher_id so we can filter student uploads out
  const teacherById = new Map(tasks.map((t) => [t.id, t.teacher_id]));

  const grouped = new Map();
  (data || []).forEach((att) => {
    const teacherId = teacherById.get(att.owner_id);
    // Only include attachments uploaded by the task's teacher (skip student uploads)
    if (teacherId && att.uploader_id !== teacherId) return;
    const list = grouped.get(att.owner_id) || [];
    list.push(att);
    grouped.set(att.owner_id, list);
  });

  return tasks.map((t) => ({
    ...t,
    attachments: grouped.get(t.id) || [],
  }));
}

export function mapTaskRow(row) {
  if (!row) return row;
  return {
    ...row,
    desc: row.description ?? null,
    subject_name: row.subject_name ?? null,
    teacher_notes: row.teacher_notes ?? null,
  };
}
