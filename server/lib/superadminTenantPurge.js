import { createSupabaseAdmin } from "./supabase.js";

const STORAGE_BUCKET = "task-attachments";
const BATCH_SIZE = 100;

/**
 * Elimina definitivamente un tenant y todos sus datos asociados:
 * 1. Archivos de storage
 * 2. Todas las filas relacionadas vía FK CASCADE (al borrar el tenant)
 * 3. Usuarios de auth.users que pertenecían solo a este tenant
 *
 * @param {string} tenantId — UUID del tenant ya en papelera
 * @returns {{ deletedUsers: number }}
 */
export async function purgeTenant(tenantId) {
  const admin = createSupabaseAdmin();

  // 1. Recoger user IDs antes de que las membresías desaparezcan con el cascade
  const { data: memberships, error: memErr } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId);

  if (memErr) throw new Error(`Cannot fetch memberships: ${memErr.message}`);
  const allUserIds = [...new Set((memberships || []).map(m => m.user_id))];

  // 2. Eliminar archivos de storage del tenant
  const { data: attachments } = await admin
    .from("attachments")
    .select("storage_path")
    .eq("tenant_id", tenantId);

  if (attachments?.length) {
    const paths = attachments.map(a => a.storage_path);
    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const { error: storErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .remove(paths.slice(i, i + BATCH_SIZE));
      if (storErr) console.warn("[purge] storage delete partial error:", storErr.message);
    }
  }

  // 3. Identificar usuarios exclusivos de este tenant (sin otras membresías)
  const exclusiveUserIds = [];
  await Promise.all(allUserIds.map(async (userId) => {
    const { count } = await admin
      .from("tenant_memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("tenant_id", tenantId);
    if (count === 0) exclusiveUserIds.push(userId);
  }));

  // 4. Borrar el tenant — FK CASCADE elimina: membresías, grupos, alumnos,
  //    tareas, adjuntos (filas), student_task_status, tickets, grades, invites,
  //    teacher_invites, teacher_profiles, subjects
  const { error: tenantErr } = await admin
    .from("tenants")
    .delete()
    .eq("id", tenantId);

  if (tenantErr) throw new Error(`Tenant delete failed: ${tenantErr.message}`);

  // 5. Eliminar auth.users de usuarios exclusivos (profiles cascada desde auth.users)
  await Promise.all(exclusiveUserIds.map(async (userId) => {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.warn(`[purge] deleteUser ${userId} failed:`, error.message);
  }));

  return { deletedUsers: exclusiveUserIds.length };
}
