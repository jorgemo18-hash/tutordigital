// `students` no tiene columna email — se resuelve por user_id vía Auth Admin
// API (sin RPC nueva, sin migración). Compartido entre el GET unificado
// (admin.students.unified.routes.js) y la previsualización de import
// (studentImportPreview.js) para no duplicar esta resolución en los dos.
export async function resolveStudentEmails(admin, students) {
  const userIds = [...new Set(students.map((s) => s.user_id).filter(Boolean))];
  const emailById = new Map();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data?.user?.email) emailById.set(userId, data.user.email);
    })
  );
  return students.map((s) => ({ ...s, email: s.user_id ? emailById.get(s.user_id) || null : null }));
}
