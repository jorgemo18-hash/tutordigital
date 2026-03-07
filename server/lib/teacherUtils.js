import { uniq as uniqValues } from "./utils.js";

function normalizeSubject(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  return {
    name: raw,
    norm: raw.toLowerCase(),
  };
}

export async function syncTeacherSubjects(admin, teacherProfileId, tenantSlug, subjectsRaw = []) {
  const normalized = uniqValues(subjectsRaw.map(normalizeSubject).filter((x) => x.name).map((x) => `${x.norm}::${x.name}`))
    .map((value) => {
      const [norm, ...rest] = value.split("::");
      return { norm, name: rest.join("::") };
    });

  if (!normalized.length) {
    await admin.from("teacher_subjects").delete().eq("teacher_profile_id", teacherProfileId);
    return [];
  }

  const { error: upsertErr } = await admin.from("subjects").upsert(
    normalized.map((item) => ({
      tenant_slug: tenantSlug,
      name: item.name,
      name_norm: item.norm,
    })),
    { onConflict: "tenant_slug,name_norm" }
  );
  if (upsertErr) throw new Error("subjects_upsert_failed");

  const norms = normalized.map((item) => item.norm);
  const { data: subjectRows, error: subjectsErr } = await admin
    .from("subjects")
    .select("id, name")
    .eq("tenant_slug", tenantSlug)
    .in("name_norm", norms);

  if (subjectsErr) throw new Error("subjects_lookup_failed");

  const subjectIds = (subjectRows || []).map((row) => row.id);
  await admin.from("teacher_subjects").delete().eq("teacher_profile_id", teacherProfileId);

  if (subjectIds.length) {
    const { error: linkErr } = await admin.from("teacher_subjects").insert(
      subjectIds.map((subjectId) => ({
        teacher_profile_id: teacherProfileId,
        subject_id: subjectId,
      }))
    );
    if (linkErr) throw new Error("teacher_subjects_sync_failed");
  }

  return subjectRows || [];
}

export async function syncTeacherGroups(admin, teacherProfileId, groupIds = [], tutorGroupId = null) {
  await admin.from("teacher_groups").delete().eq("teacher_profile_id", teacherProfileId);

  const uniqueGroupIds = uniqValues(groupIds.filter(Boolean));
  if (!uniqueGroupIds.length) return [];

  const rows = uniqueGroupIds.map((groupId) => ({
    teacher_profile_id: teacherProfileId,
    group_id: groupId,
    is_tutor: tutorGroupId ? tutorGroupId === groupId : false,
  }));

  const { error } = await admin.from("teacher_groups").insert(rows);
  if (error) throw new Error("teacher_groups_sync_failed");
  return rows;
}

export async function autoRedeemInvites(admin, userId, email) {
  if (!email) return;
  const safeEmail = String(email || "").trim().toLowerCase();

  // Buscar invitaciones pendientes para este email
  const { data: invites } = await admin
    .from("teacher_invites")
    .select("id, tenant_id, display_name, subjects, group_ids, tutor_group_id")
    .eq("email", safeEmail)
    .eq("status", "pending");

  if (!invites || !invites.length) {
    // console.log(`[AUTO_REDEEM] No pending invites found for ${safeEmail}`);
    return;
  }

  for (const invite of invites) {
    // Recuperar el slug del tenant de forma segura
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug")
      .eq("id", invite.tenant_id)
      .maybeSingle();
      
    const tenantSlug = tenant?.slug;
    if (!tenantSlug) {
      console.error(`[AUTO_REDEEM] Tenant slug not found for id ${invite.tenant_id}`);
      continue;
    }

    console.log(`[AUTO_REDEEM] Processing invite ${invite.id} for tenant ${tenantSlug}`);

    // 1. Crear/Activar membership
    const { error: memberErr } = await admin.from("tenant_memberships").upsert(
      {
        tenant_id: invite.tenant_id,
        user_id: userId,
        role: "teacher",
        status: "active",
      },
      { onConflict: "tenant_id,user_id" }
    );

    if (memberErr) {
      console.error("[AUTO_REDEEM] Failed membership", memberErr);
      continue;
    }

    // 2. Crear/Actualizar perfil de profesor
    const { data: profile, error: profileErr } = await admin
      .from("teacher_profiles")
      .upsert(
        {
          tenant_slug: tenantSlug,
          email: safeEmail,
          display_name: invite.display_name,
          user_id: userId,
          is_active: true,
        },
        { onConflict: "tenant_slug,email" }
      )
      .select("id")
      .single();

    if (profileErr || !profile) {
      console.error("[AUTO_REDEEM] Failed profile", profileErr);
      continue;
    }

    // 3. Sincronizar datos
    await syncTeacherSubjects(admin, profile.id, tenantSlug, invite.subjects || []);
    await syncTeacherGroups(admin, profile.id, invite.group_ids || [], invite.tutor_group_id || null);

    // 4. Marcar invitación como usada
    await admin.from("teacher_invites").update({ status: "used", used_at: new Date().toISOString() }).eq("id", invite.id);
    console.log(`[AUTO_REDEEM] Successfully redeemed invite ${invite.id}`);
  }
}
