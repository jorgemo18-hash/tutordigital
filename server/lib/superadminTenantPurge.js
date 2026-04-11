import { createSupabaseAdmin } from "./supabase.js";

const STORAGE_BUCKET = "task-attachments";
const BATCH_SIZE = 100;

/**
 * Elimina definitivamente un tenant y todos sus datos asociados:
 * 1. Archivos de storage
 * 2. Todas las filas relacionadas vía FK CASCADE (al borrar el tenant)
 * 3. Usuarios de auth.users que pertenecían solo a este tenant
 * 4. Verifica que no queden identidades huérfanas en auth.identities
 *
 * @param {string} tenantId — UUID del tenant ya en papelera
 * @returns {{ deletedUsers: number }}
 */
export async function purgeTenant(tenantId) {
  const admin = createSupabaseAdmin();
  console.log(`[purge] Iniciando purge de tenant ${tenantId}`);

  // 1. Recoger user IDs (y emails) antes de que las membresías desaparezcan con el cascade
  const { data: memberships, error: memErr } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId);

  if (memErr) throw new Error(`Cannot fetch memberships: ${memErr.message}`);
  const allUserIds = [...new Set((memberships || []).map(m => m.user_id))];
  console.log(`[purge] Usuarios encontrados en el tenant: ${allUserIds.length} —`, allUserIds);

  // Obtener emails de todos los usuarios ANTES de borrar nada (para verificación posterior)
  const userEmails = {};
  for (const userId of allUserIds) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (authUser?.user?.email) {
      userEmails[userId] = authUser.user.email.toLowerCase().trim();
      console.log(`[purge] Usuario ${userId} → email: ${userEmails[userId]}`);
    } else {
      console.warn(`[purge] No se pudo obtener email de usuario ${userId}`);
    }
  }

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
  // Se usa select + limit(1) en lugar de head:true+count porque el cliente
  // de Supabase puede devolver count=null (no 0) para resultados vacíos.
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
    const email = userEmails[userId];
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`[purge] deleteUser ${userId} (${email || "?"}) failed:`, error.message);
    } else {
      console.log(`[purge] Usuario ${userId} (${email || "?"}) eliminado de auth.users`);
      deletedCount++;

      // 6. Verificar que no quedan identidades en auth.identities para este email
      if (email) {
        const { data: remainingIds, error: findErr } = await admin.rpc(
          "admin_find_identities_by_email",
          { p_email: email }
        );
        if (findErr) {
          console.warn(`[purge] No se pudo verificar identidades de ${email}:`, findErr.message);
        } else if (remainingIds && remainingIds.length > 0) {
          console.warn(
            `[purge] ALERTA: quedan ${remainingIds.length} identidad(es) en auth.identities para ${email}:`,
            JSON.stringify(remainingIds)
          );
          // Intentar limpiar identidades huérfanas (cuyo usuario ya no existe)
          const { data: cleaned, error: cleanErr } = await admin.rpc(
            "admin_delete_orphaned_identities",
            { p_email: email }
          );
          if (cleanErr) {
            console.warn(`[purge] Error limpiando identidades huérfanas de ${email}:`, cleanErr.message);
          } else {
            console.log(
              `[purge] Identidades huérfanas eliminadas para ${email}:`,
              JSON.stringify(cleaned || [])
            );
            // Si quedan identidades vinculadas a usuarios reales, loguear para diagnóstico
            const stillRemaining = remainingIds.filter(
              r => r.user_exists && !(cleaned || []).some(c => c.identity_id === r.identity_id)
            );
            if (stillRemaining.length > 0) {
              console.warn(
                `[purge] ADVERTENCIA: identidades vinculadas a otros usuarios reales para ${email}:`,
                JSON.stringify(stillRemaining)
              );
            }
          }
        } else {
          console.log(`[purge] Verificación OK: no quedan identidades para ${email}`);
        }
      }
    }
  }

  console.log(`[purge] Purge completado — ${deletedCount} usuario(s) eliminado(s) de auth`);
  return { deletedUsers: deletedCount };
}
