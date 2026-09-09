function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function getTeacherProfileForUser(admin, { tenantSlug, userId, email = "" }) {
  if (!tenantSlug || !userId) return null;

  const { data: byUser } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("user_id", userId)
    .maybeSingle();

  if (byUser?.id) return byUser;

  const safeEmail = normalizeEmail(email);
  if (!safeEmail) return null;

  const { data: byEmail } = await admin
    .from("teacher_profiles")
    .select("id, user_id")
    .eq("tenant_slug", tenantSlug)
    .eq("email", safeEmail)
    .maybeSingle();

  if (!byEmail?.id) return null;

  if (!byEmail.user_id) {
    await admin.from("teacher_profiles").update({ user_id: userId }).eq("id", byEmail.id);
  }

  return byEmail;
}

// AQUÍ VIVÍA getTeacherAssignedGroupIds. Devolvía `null` tanto cuando el
// profesor no tenía ficha como cuando la consulta fallaba, y su único
// llamador (groups.routes.js) interpretaba `null` como "no restringir": un
// error transitorio de la base de datos le abría todos los grupos del
// centro. Sustituido el 09/09/2026 por resolverGrupoIdsVisibles
// (lib/instituto/alumnosVisibles.js), que devuelve siempre una lista para un
// profesor y un error explícito cuando algo falla.
