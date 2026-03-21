import { z } from "zod";
import crypto from "node:crypto";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getBuildInfo } from "../../lib/version.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(96),
  stage: z.string().trim().min(1).max(32).optional().nullable(),
  year: z.coerce.number().int().min(1).max(6).optional().nullable(),
  track: z.string().trim().min(1).max(32).optional().nullable(),
  variant: z.string().trim().min(1).max(32).optional().nullable(),
  level: z.string().trim().min(1).max(32).optional().nullable(),
});

const AddStudentSchema = z.object({
  email: z.string().email(),
});

const ImportStudentsSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(500),
});

const GroupParamsSchema = z.object({
  groupId: z.string().uuid(),
});

const StudentParamsSchema = z.object({
  groupId: z.string().uuid(),
  studentId: z.string().uuid(),
});

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeGroupName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

function hashJoinCode(code = "") {
  const pepper = process.env.JOIN_CODE_PEPPER || process.env.INVITE_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
}

async function assertGroupBelongsToTenant(admin, tenantId, groupId, reply, requestId) {
  const { data, error } = await admin
    .from("groups")
    .select("id, name")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    fail(reply, 500, "group_lookup_failed", "Failed to lookup group", requestId);
    return null;
  }
  if (!data) {
    fail(reply, 404, "group_not_found", "Group not found", requestId);
    return null;
  }
  return data;
}

// ── Routes ─────────────────────────────────────────────────────────────────

export default async function adminStudentsRoutes(app) {
  const createSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_STUDENTS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_STUDENTS_RATE_MAX",
    routeName: "admin-students",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // ── POST /admin/groups ─ crear grupo ────────────────────────────────────
  app.post(
    "/admin/groups",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsed = CreateGroupSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
      }

      const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const { name, stage, year, track, variant, level } = parsed.data;
      const normalizedName = normalizeGroupName(name);
      const joinCode = generateJoinCode();
      const joinCodeHash = hashJoinCode(joinCode);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("groups")
        .insert({
          tenant_id: auth.tenant.id,
          name: name.trim(),
          normalized_name: normalizedName,
          stage: stage || null,
          year: year || null,
          track: track || null,
          variant: variant || null,
          level: level || stage || null,
          join_code_hash: joinCodeHash,
        })
        .select("id, name, level, stage, year, track, variant, created_at")
        .single();

      if (error) {
        if (error.code === "23505") {
          return fail(reply, 409, "duplicate_group", "Ya existe un grupo con ese nombre", requestId);
        }
        req.log.error({ err: error, requestId }, "admin group create failed");
        return fail(reply, 500, "group_create_failed", "Failed to create group", requestId);
      }

      // Devolver el código en claro solo en la respuesta de creación
      return created(reply, { group: data, join_code: joinCode }, requestId);
    }
  );

  // ── GET /admin/groups ─ listar grupos ───────────────────────────────────
  app.get(
    "/admin/groups",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const rl = await rateLimit(req, { limit: 120, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("groups")
        .select("id, name, level, stage, year, track, variant, created_at")
        .eq("tenant_id", auth.tenant.id)
        .order("stage", { ascending: true, nullsFirst: false })
        .order("year", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (error) {
        return fail(reply, 500, "groups_fetch_failed", "Failed to fetch groups", requestId);
      }

      return ok(reply, { items: data || [] }, requestId);
    }
  );

  // ── GET /admin/groups/:groupId/students ─ listar alumnos ────────────────
  app.get(
    "/admin/groups/:groupId/students",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return fail(reply, 400, "invalid_params", "Invalid params", requestId);
      }

      const rl = await rateLimit(req, { limit: 120, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const { data, error } = await admin
        .from("student_invites")
        .select("id, email, status, created_at")
        .eq("group_id", parsedParams.data.groupId)
        .eq("tenant_id", auth.tenant.id)
        .order("created_at", { ascending: false });

      if (error) {
        return fail(reply, 500, "students_fetch_failed", "Failed to fetch students", requestId);
      }

      return ok(reply, { group, items: data || [] }, requestId);
    }
  );

  // ── POST /admin/groups/:groupId/students ─ añadir email ─────────────────
  app.post(
    "/admin/groups/:groupId/students",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return fail(reply, 400, "invalid_params", "Invalid params", requestId);
      }

      const parsed = AddStudentSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
      }

      const rl = await rateLimit(req, { limit: 100, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const email = normalizeEmail(parsed.data.email);
      const { data, error } = await admin
        .from("student_invites")
        .insert({
          tenant_id: auth.tenant.id,
          group_id: parsedParams.data.groupId,
          email,
          created_by: auth.user.id,
        })
        .select("id, email, status, created_at")
        .single();

      if (error) {
        if (error.code === "23505") {
          return fail(reply, 409, "student_already_invited", "Este email ya está autorizado para este grupo", requestId);
        }
        req.log.error({ err: error, requestId }, "admin add student invite failed");
        return fail(reply, 500, "student_invite_failed", "Failed to add student", requestId);
      }

      return created(reply, { invite: data }, requestId);
    }
  );

  // ── POST /admin/groups/:groupId/students/import ─ importar lista ─────────
  app.post(
    "/admin/groups/:groupId/students/import",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return fail(reply, 400, "invalid_params", "Invalid params", requestId);
      }

      const parsed = ImportStudentsSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
      }

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const emails = [...new Set(parsed.data.emails.map(normalizeEmail).filter(Boolean))];
      const rows = emails.map((email) => ({
        tenant_id: auth.tenant.id,
        group_id: parsedParams.data.groupId,
        email,
        created_by: auth.user.id,
      }));

      // upsert ignorando duplicados (misma fila ya existente se mantiene)
      const { data, error } = await admin
        .from("student_invites")
        .upsert(rows, { onConflict: "group_id,email", ignoreDuplicates: true })
        .select("id, email, status, created_at");

      if (error) {
        req.log.error({ err: error, requestId }, "admin import students failed");
        return fail(reply, 500, "import_failed", "Failed to import students", requestId);
      }

      return created(
        reply,
        { imported: (data || []).length, total_submitted: emails.length },
        requestId
      );
    }
  );

  // ── DELETE /admin/groups/:groupId/students/:studentId ─ revocar ──────────
  app.delete(
    "/admin/groups/:groupId/students/:studentId",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      const build = getBuildInfo();
      reply.header("x-ttd-version", build.label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = StudentParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return fail(reply, 400, "invalid_params", "Invalid params", requestId);
      }

      const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("student_invites")
        .update({ status: "revoked" })
        .eq("id", parsedParams.data.studentId)
        .eq("group_id", parsedParams.data.groupId)
        .eq("tenant_id", auth.tenant.id)
        .select("id, email, status")
        .maybeSingle();

      if (error) {
        return fail(reply, 500, "revoke_failed", "Failed to revoke student", requestId);
      }
      if (!data) {
        return fail(reply, 404, "student_invite_not_found", "Invite not found", requestId);
      }

      return ok(reply, data, requestId);
    }
  );
}
