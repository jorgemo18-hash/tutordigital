import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getBuildInfo } from "../../lib/version.js";
import { z } from "zod";
import {
  CreateGroupSchema,
  GroupParamsSchema,
  normalizeGroupName,
  normalizeTrack,
  generateJoinCode,
  hashJoinCode,
} from "../../lib/adminStudentHelpers.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const EnsureGroupSchema = z.object({
  stage: z.enum(["primaria", "eso", "bachiller", "bach"]),
  year: z.coerce.number().int().min(1).max(6),
  track: z.string().min(1).max(16),
  name: z.string().trim().min(1).max(96).optional(),
  level: z.string().trim().min(1).max(32).optional(),
  normalized_name: z.string().trim().min(3).max(128).optional(),
});

// ── Local helpers ──────────────────────────────────────────────────────────

function normalizedGroupKey(stage, year, track) {
  return `${String(stage || "").trim()}|${Number(year) || ""}|${normalizeTrack(track)}`.toLowerCase();
}

function stageLabel(stage) {
  if (stage === "primaria") return "Primaria";
  if (stage === "eso") return "ESO";
  return "Bachillerato";
}

function canonicalStage(stage) {
  return stage === "bach" ? "bachiller" : stage;
}

async function assertGroupBelongsToTenant(admin, tenantId, groupId, reply, requestId) {
  const { data, error } = await admin
    .from("groups")
    .select("id, name, join_code_hint")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) { fail(reply, 500, "group_lookup_failed", "Failed to lookup group", requestId); return null; }
  if (!data)  { fail(reply, 404, "group_not_found", "Group not found", requestId); return null; }
  return data;
}

// ── Routes ─────────────────────────────────────────────────────────────────

export default async function adminGroupsRoutes(app) {
  const security = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_GROUPS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_GROUPS_RATE_MAX",
    routeName: "admin-groups-ensure",
  });
  const crudSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_STUDENTS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_STUDENTS_RATE_MAX",
    routeName: "admin-groups-crud",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // ── POST /admin/groups — crear grupo ─────────────────────────────────────
  app.post(
    "/admin/groups",
    { preHandler: [crudSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

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
      // Fix 1: normalized_name includes track so "4 PRIM A" y "4 PRIM B" coexisten
      const normalizedTrack = track ? normalizeTrack(track) : null;
      const normalizedName = [normalizeGroupName(name), normalizedTrack?.toLowerCase()].filter(Boolean).join("|");
      const joinCode = generateJoinCode();
      const joinCodeHash = hashJoinCode(joinCode);
      const joinCodeHint = joinCode.slice(0, 4);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("groups")
        .insert({
          tenant_id: auth.tenant.id,
          name: name.trim(),
          normalized_name: normalizedName,
          stage: stage || null,
          year: year || null,
          track: normalizedTrack,
          variant: variant || "main",
          level: level || stage || null,
          join_code_hash: joinCodeHash,
          join_code_hint: joinCodeHint,
        })
        .select("id, name, level, stage, year, track, variant, join_code_hint, created_at")
        .single();

      if (error) {
        if (error.code === "23505") {
          return fail(reply, 409, "duplicate_group", "Ya existe un grupo con ese nombre y vía en este curso", requestId);
        }
        req.log.error({ err: error, requestId }, "admin group create failed");
        return fail(reply, 500, "group_create_failed", "Failed to create group", requestId);
      }

      return created(reply, { group: data, join_code: joinCode }, requestId);
    }
  );

  // ── GET /admin/groups — listar grupos ────────────────────────────────────
  app.get(
    "/admin/groups",
    { preHandler: [crudSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const rl = await rateLimit(req, { limit: 120, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      let query = admin
        .from("groups")
        .select("id, name, level, stage, year, track, variant, join_code_hint, created_at")
        .eq("tenant_id", auth.tenant.id);

      const { stage, year } = req.query || {};
      if (stage) query = query.eq("stage", String(stage));
      if (year)  query = query.eq("year", Number(year));

      query = query
        .order("stage", { ascending: true, nullsFirst: false })
        .order("year",  { ascending: true, nullsFirst: false })
        .order("name",  { ascending: true });

      const { data: groups, error } = await query;
      if (error) return fail(reply, 500, "groups_fetch_failed", "Failed to fetch groups", requestId);

      // Añadir número de alumnos activos por grupo (sin N+1 queries)
      const { data: invites } = await admin
        .from("student_invites")
        .select("group_id")
        .eq("tenant_id", auth.tenant.id)
        .neq("status", "revoked");

      const countByGroup = {};
      for (const inv of (invites || [])) {
        countByGroup[inv.group_id] = (countByGroup[inv.group_id] || 0) + 1;
      }

      const items = (groups || []).map((g) => ({ ...g, student_count: countByGroup[g.id] || 0 }));
      return ok(reply, { items }, requestId);
    }
  );

  // ── DELETE /admin/groups/:groupId — eliminar grupo ───────────────────────
  app.delete(
    "/admin/groups/:groupId",
    { preHandler: [crudSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { groupId } = parsedParams.data;

      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, groupId, reply, requestId);
      if (!group) return;

      // Eliminar invitaciones de alumnos primero
      await admin.from("student_invites").delete().eq("group_id", groupId).eq("tenant_id", auth.tenant.id);

      // Eliminar el grupo
      const { error } = await admin.from("groups").delete().eq("id", groupId).eq("tenant_id", auth.tenant.id);
      if (error) {
        req.log.error({ err: error, requestId }, "admin group delete failed");
        return fail(reply, 500, "group_delete_failed", "Failed to delete group", requestId);
      }

      return ok(reply, { deleted: true, groupId }, requestId);
    }
  );

  // ── POST /admin/groups/ensure ────────────────────────────────────────────
  app.post(
    "/admin/groups/ensure",
    { preHandler: [security.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      try {
        const requestId = req.requestId || makeRequestId();
        const tenantSlug = String(getTenantSlug(req) || "").trim();
        if (!tenantSlug) return fail(reply, 400, "tenant_slug_required", "Tenant slug required", requestId);

        const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
        if (!auth.ok) return;
        if (!auth?.tenant?.id) return fail(reply, 403, "tenant_forbidden", "Tenant forbidden", requestId);

        const parsed = EnsureGroupSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
        }

        const stage = canonicalStage(parsed.data.stage);
        const year = Number(parsed.data.year);
        const track = normalizeTrack(parsed.data.track);
        if (!track || !/^[A-Z0-9_-]{1,16}$/.test(track)) return fail(reply, 400, "invalid_track", "Invalid track", requestId);

        const name = String(parsed.data.name || `${year}º ${stageLabel(stage)} - ${track}`).trim();
        const normalizedName = String(parsed.data.normalized_name || normalizedGroupKey(stage, year, track)).toLowerCase();
        const admin = createSupabaseAdmin();

        let existing = null;
        let findErr = null;
        ({ data: existing, error: findErr } = await admin
          .from("groups").select("id, name, level, created_at")
          .eq("tenant_id", auth.tenant.id).eq("normalized_name", normalizedName).maybeSingle());

        if (findErr && (findErr.code === "42703" || String(findErr.message || "").includes("normalized_name"))) {
          ({ data: existing, error: findErr } = await admin
            .from("groups").select("id, name, level, created_at")
            .eq("tenant_id", auth.tenant.id).eq("name", name).maybeSingle());
        }
        if (findErr) return fail(reply, 500, "groups_lookup_failed", "Failed to lookup groups", requestId);
        if (existing?.id) return ok(reply, existing, requestId);

        let createdRow = null;
        let createErr = null;
        ({ data: createdRow, error: createErr } = await admin
          .from("groups").insert({ tenant_id: auth.tenant.id, name, level: String(parsed.data.level || stage), normalized_name: normalizedName })
          .select("id, name, level, created_at").single());

        if (createErr && (createErr.code === "42703" || String(createErr.message || "").includes("normalized_name"))) {
          ({ data: createdRow, error: createErr } = await admin
            .from("groups").insert({ tenant_id: auth.tenant.id, name, level: String(parsed.data.level || stage) })
            .select("id, name, level, created_at").single());
        }

        if (createErr) {
          if (createErr.code === "23505") {
            let raced = null;
            let racedErr = null;
            ({ data: raced, error: racedErr } = await admin
              .from("groups").select("id, name, level, created_at")
              .eq("tenant_id", auth.tenant.id).eq("name", name).maybeSingle());
            if (!racedErr && raced?.id) return ok(reply, raced, requestId);
            ({ data: raced, error: racedErr } = await admin
              .from("groups").select("id, name, level, created_at")
              .eq("tenant_id", auth.tenant.id).eq("normalized_name", normalizedName).maybeSingle());
            if (!racedErr && raced?.id) return ok(reply, raced, requestId);
          }
          req.log.error({ err: createErr, requestId }, "groups ensure create failed");
          return fail(reply, 500, "group_create_failed", "Failed to create group", requestId);
        }

        return ok(reply, createdRow, requestId);
      } catch (err) {
        const requestId = req.requestId || makeRequestId();
        req.log.error({ err, requestId }, "admin groups ensure unhandled error");
        return fail(reply, 500, "group_ensure_failed", "Failed to ensure group", requestId);
      }
    }
  );

  // ── POST /admin/groups/:groupId/regenerate-code ─ nuevo código ───────────
  // Movida aquí desde admin.students.routes.js (que ya estaba al límite de
  // 400 líneas) — es una operación sobre el grupo, no sobre alumnos.
  app.post(
    "/admin/groups/:groupId/regenerate-code",
    { preHandler: [crudSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const joinCode = generateJoinCode();
      const joinCodeHash = hashJoinCode(joinCode);
      const joinCodeHint = joinCode.slice(0, 4);

      const { data, error } = await admin
        .from("groups")
        .update({ join_code_hash: joinCodeHash, join_code_hint: joinCodeHint })
        .eq("id", parsedParams.data.groupId)
        .eq("tenant_id", auth.tenant.id)
        .select("id, name, join_code_hint")
        .single();

      if (error) {
        req.log.error({ err: error, requestId }, "admin regenerate-code failed");
        return fail(reply, 500, "regenerate_code_failed", "Failed to regenerate code", requestId);
      }

      return ok(reply, { group: data, join_code: joinCode }, requestId);
    }
  );
}
