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

export async function getTeacherAssignedGroupIds(admin, { tenantSlug, userId, email = "" }) {
  const profile = await getTeacherProfileForUser(admin, { tenantSlug, userId, email });
  if (!profile?.id) return null;

  const { data, error } = await admin
    .from("teacher_groups")
    .select("group_id")
    .eq("teacher_profile_id", profile.id);

  if (error) return null;
  return (data || []).map((row) => row.group_id).filter(Boolean);
}
