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
  console.log(`[purge] Iniciando purge de tenant ${tenantId}`);

  // 1. Recoger user IDs antes de que las membresías desaparezcan con el cascade
  const { data: memberships, error: memErr } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId);

  if (memErr) throw new Error(`Cannot fetch memberships: ${memErr.message}`);
  const allUserIds = [...new Set((memberships || []).map(m => m.user_id))];
  console.log(`[purge] Usuarios encontrados en el tenant: ${allUserIds.length} —`, allUserIds);

  // 2. Eliminar archivos de storage del tenant
  const { data: attachments } = await admin
    .from("attachments")
    .select("storage_path")
    .eq("tenant_id", tenantId);

  if (attachments?.length) {
    console.log(`[purge] Eliminando ${attachments.length} archivo(s) de storage`);
    const paths = attachments.map(a => a.storage_path);
    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const { error: storErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .remove(paths.slice(i, i + BATCH_SIZE));
      if (storErr) console.warn("[purge] storage delete partial error:", storErr.message);
    }
  } else {
    console.log("[purge] Sin archivos de storage que eliminar");
  }

  // 3. Identificar usuarios exclusivos de este tenant (sin otras membresías)
  // Nota: se usa select + limit(1) en lugar de head:true+count porque el cliente
  // de Supabase puede devolver count=null (no 0) para resultados vacíos, lo que
  // haría que count === 0 fuera false y ningún usuario se borrase de auth.users.
  const exclusiveUserIds = [];
  for (const userId of allUserIds) {
    const { data: otherMems, error: checkErr } = await admin
      .from("tenant_memberships")
      .select("id")
      .eq("user_id", userId)
      .neq("tenant_id", tenantId)
      .limit(1);

    if (checkErr) {
      console.warn(`[purge] No se pudo comprobar membresías de ${userId}:`, checkErr.message);
      console.warn(`[purge] → Usuario ${userId} OMITIDO por precaución`);
      continue;
    }

    const hasOtherTenants = otherMems !== null && otherMems.length > 0;
    if (hasOtherTenants) {
      console.log(`[purge] Usuario ${userId} pertenece a otros centros — se conserva`);
    } else {
      console.log(`[purge] Usuario ${userId} es exclusivo de este tenant — se eliminará`);
      exclusiveUserIds.push(userId);
    }
  }

  console.log(`[purge] Usuarios a eliminar de auth.users: ${exclusiveUserIds.length}`);

  // 4. Borrar el tenant — FK CASCADE elimina: membresías, grupos, alumnos,
  //    tareas, adjuntos (filas), student_task_status, tickets, grades, invites,
  //    teacher_invites, teacher_profiles, subjects
  console.log(`[purge] Eliminando fila del tenant (cascade)…`);
  const { error: tenantErr } = await admin
    .from("tenants")
    .delete()
    .eq("id", tenantId);

  if (tenantErr) throw new Error(`Tenant delete failed: ${tenantErr.message}`);
  console.log("[purge] Tenant y datos en cascada eliminados");

  // 5. Eliminar auth.users de usuarios exclusivos (profiles cascada desde auth.users)
  let deletedCount = 0;
  for (const userId of exclusiveUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`[purge] deleteUser ${userId} failed:`, error.message);
    } else {
      console.log(`[purge] Usuario ${userId} eliminado de auth.users`);
      deletedCount++;
    }
  }

  console.log(`[purge] Purge completado — ${deletedCount} usuario(s) eliminado(s) de auth`);
  return { deletedUsers: deletedCount };
}
