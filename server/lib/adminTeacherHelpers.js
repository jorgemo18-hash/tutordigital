import { z } from "zod";
import crypto from "node:crypto";

// ── Schemas ────────────────────────────────────────────────────────────────

export const InviteSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(120),
  subjects: z.array(z.string().min(1).max(80)).default([]),
  group_ids: z.array(z.string().uuid()).default([]),
  tutor_group_id: z.string().uuid().optional().nullable(),
});

export const RevokeParamsSchema = z.object({
  id: z.string().uuid(),
});

// ── Pure utilities ─────────────────────────────────────────────────────────

export function hashInviteCode(code = "") {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JOIN_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function safeStr(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function uniq(values = []) {
  return Array.from(new Set(values));
}

export function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += pick();
    if (i === 3) out += "-";
  }
  return out;
}

// ── Supabase error helpers ─────────────────────────────────────────────────

export function isSchemaError(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "42p01" ||
    code === "PGRST204" ||
    code === "PGRST200" ||
    message.includes("column") ||
    message.includes("relationship") ||
    message.includes("does not exist")
  );
}

export function compactSupabaseError(err) {
  if (!err) return null;
  return {
    code: err.code || "",
    message: err.message || "",
    details: err.details || "",
    hint: err.hint || "",
    status: err.status || "",
  };
}

export function formatSbError(err) {
  if (!err) return null;
  return {
    message: err.message || String(err),
    code: err.code || "",
    details: err.details || "",
    hint: err.hint || "",
    status: err.status || "",
  };
}

export function isMissingRelation(err) {
  const message = String(err?.message || "");
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message)
  );
}

export function isRecoverableSchemaError(err) {
  if (!err) return false;
  if (isMissingRelation(err)) return true;
  const code = String(err.code || "");
  return (
    code === "42703" ||
    code === "22P02" ||
    code === "23502" ||
    code === "23514" ||
    code === "PGRST204" ||
    code === "PGRST205"
  );
}

export function getErrText(err) {
  return [
    err?.message,
    err?.details,
    err?.hint,
    err?.constraint,
    err?.cause?.constraint,
    err?.cause?.message,
    err?.cause?.details,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function isUnique23505(err) {
  let cur = err;
  while (cur) {
    if (String(cur?.code || "").trim() === "23505") return true;
    cur = cur?.cause;
  }
  return false;
}

export function isActiveUniqueInviteConflict(err) {
  const t = getErrText(err);
  if (t.includes("teacher_invites_tenant_email_active_uniq")) return true;
  let cur = err;
  while (cur) {
    if (String(cur?.constraint || "").trim() === "teacher_invites_tenant_email_active_uniq") return true;
    cur = cur?.cause;
  }
  return false;
}

export function isInviteActiveRow(row) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  const now = Date.now();
  if (row.used_at) return false;
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return false;
  if (status && status !== "pending" && status !== "active") return false;
  return true;
}

// ── Data mapping ───────────────────────────────────────────────────────────

export function mapTeachers(profiles = [], subjects = [], groups = [], invites = []) {
  const subjectsByProfile = new Map();
  const groupsByProfile = new Map();
  const inviteByEmail = new Map();

  subjects.forEach((row) => {
    const teacherProfileId = row.teacher_profile_id;
    const list = subjectsByProfile.get(teacherProfileId) || [];
    if (row.subject?.name) list.push(row.subject.name);
    subjectsByProfile.set(teacherProfileId, list);
  });

  groups.forEach((row) => {
    const teacherProfileId = row.teacher_profile_id;
    const list = groupsByProfile.get(teacherProfileId) || [];
    if (row.group?.id) {
      list.push({
        id: row.group.id,
        name: row.group.name || "",
        level: row.group.level || null,
        is_tutor: Boolean(row.is_tutor),
      });
    }
    groupsByProfile.set(teacherProfileId, list);
  });

  invites.forEach((row) => {
    const email = normalizeEmail(row.email);
    const prev = inviteByEmail.get(email);
    if (!prev) {
      inviteByEmail.set(email, row);
      return;
    }
    if (String(row.created_at || "") > String(prev.created_at || "")) {
      inviteByEmail.set(email, row);
    }
  });

  return profiles.map((profile) => {
    const email = normalizeEmail(profile.email);
    const invite = inviteByEmail.get(email) || null;
    return {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      is_active: Boolean(profile.is_active),
      user_id: profile.user_id || null,
      subjects: subjectsByProfile.get(profile.id) || [],
      groups: groupsByProfile.get(profile.id) || [],
      invite: invite
        ? {
            id: invite.id,
            status: invite.status,
            created_at: invite.created_at,
            used_at: invite.used_at,
            expires_at: invite.expires_at,
          }
        : null,
    };
  });
}
