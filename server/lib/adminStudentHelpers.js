import { z } from "zod";
import crypto from "node:crypto";

// ── Schemas ────────────────────────────────────────────────────────────────

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(96),
  stage: z.string().trim().min(1).max(32).optional().nullable(),
  year: z.coerce.number().int().min(1).max(6).optional().nullable(),
  track: z.string().trim().min(1).max(32).optional().nullable(),
  variant: z.string().trim().min(1).max(32).optional().nullable(),
  level: z.string().trim().min(1).max(32).optional().nullable(),
});

export const AddStudentSchema = z.object({
  email: z.string().email(),
});

export const ImportStudentsSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(500),
});

export const GroupParamsSchema = z.object({
  groupId: z.string().uuid(),
});

export const StudentParamsSchema = z.object({
  groupId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export const ResendStudentParamsSchema = z.object({
  groupId:   z.string().uuid(),
  studentId: z.string().uuid(),
});

// ── Pure helpers ───────────────────────────────────────────────────────────

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeGroupName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeTrack(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16);
}

export function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

export function hashJoinCode(code = "") {
  const pepper = process.env.JOIN_CODE_PEPPER || process.env.INVITE_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}
