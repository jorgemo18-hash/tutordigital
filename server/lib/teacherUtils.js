import { uniq as uniqValues } from "./utils.js";
import { ensureProfileExists } from "./profileProvisioning.js";

function normalizeSubject(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  return {
    name: raw,
    norm: raw.toLowerCase(),
  };
}

function subjectsFromAssignments(assignments) {
  return (assignments || []).map(a => String(a.subject || "").trim()).filter(Boolean);
}

function groupIdsFromAssignments(assignments) {
  return (assignments || []).flatMap(a => a.group_ids || []).filter(Boolean);
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

// opts.assignments:   [{subject, group_ids}] — when provided, populates subject_id per group
// opts.tenantSlug:    required when assignments provided
// opts.tutorGroupIds: Set|Array<groupId> — groups where is_tutor = true (takes precedence over tutorGroupId)
export async function syncTeacherGroups(admin, teacherProfileId, groupIds = [], tutorGroupId = null, opts = {}) {
  await admin.from("teacher_groups").delete().eq("teacher_profile_id", teacherProfileId);

  const uniqueGroupIds = uniqValues(groupIds.filter(Boolean));
  if (!uniqueGroupIds.length) return [];

  // Build group → subject_id map and TGS rows from assignments in a single subjects lookup
  const groupSubjectMap = new Map();
  const tgsRows = [];
  const { assignments, tenantSlug, tutorGroupIds } = opts;
  if (assignments && assignments.length && tenantSlug) {
    const subjectNorms = uniqValues(
      assignments.map(a => String(a.subject || "").trim().toLowerCase()).filter(Boolean)
    );
    if (subjectNorms.length) {
      const { data: subjectRows } = await admin
        .from("subjects")
        .select("id, name_norm")
        .eq("tenant_slug", tenantSlug)
        .in("name_norm", subjectNorms);
      const normToId = new Map((subjectRows || []).map(r => [r.name_norm, r.id]));
      for (const a of assignments) {
        const norm = String(a.subject || "").trim().toLowerCase();
        const subjectId = normToId.get(norm) || null;
        for (const groupId of (a.group_ids || [])) {
          if (!groupSubjectMap.has(groupId)) groupSubjectMap.set(groupId, subjectId);
          if (subjectId) {
            tgsRows.push({ teacher_profile_id: teacherProfileId, group_id: groupId, subject_id: subjectId });
          }
        }
      }
    }
  }

  // tutorGroupIds (Set/Array) takes precedence over the legacy single tutorGroupId parameter
  const tutorSet = tutorGroupIds
    ? new Set(Array.isArray(tutorGroupIds) ? tutorGroupIds : [...tutorGroupIds])
    : null;

  const rows = uniqueGroupIds.map((groupId) => ({
    teacher_profile_id: teacherProfileId,
    group_id: groupId,
    is_tutor: tutorSet ? tutorSet.has(groupId) : (tutorGroupId ? tutorGroupId === groupId : false),
    subject_id: groupSubjectMap.get(groupId) || null,
  }));

  const { error } = await admin.from("teacher_groups").insert(rows);
  if (error) throw new Error("teacher_groups_sync_failed");

  await admin.from("teacher_group_subjects").delete().eq("teacher_profile_id", teacherProfileId);
  if (tgsRows.length) {
    await admin.from("teacher_group_subjects").insert(tgsRows);
  }

  return rows;
}

// autoRedeemInvites SE HA ELIMINADO (auditoría del 08/09/2026).
//
// Canjeaba las invitaciones de profesor buscando SOLO POR EMAIL, y se
// llamaba en cada login y en cada carga de perfil. Bastaba con tener una
// cuenta con el email de un profesor invitado —y había una ruta pública que
// creaba cuentas ya confirmadas con el email que le pidieras— para que el
// sistema te concediera rol de profesor en el centro de otro, con acceso a
// su horario, su diario y los nombres de sus alumnos menores.
//
// El canje bueno exige el TOKEN del enlace del correo, comprueba su hash y
// su caducidad, y vive en teacher.invites.routes.js#/invite/redeem — que es
// lo que llama invite.html. El signup ya evitaba a propósito el canje
// automático (ver el comentario en auth.routes.js); login y /me se quedaron
// con la puerta abierta.
//
// Si algún día vuelve a hacer falta un canje sin token, no se resuelve
// buscando por email: se resuelve verificando que la cuenta se creó DESDE la
// invitación.
