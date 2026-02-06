import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import {
  GroupsQuerySchema,
  GroupCreateSchema,
} from "../../lib/validators.js";

function normalizeGroupName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export default async function groupsRoutes(app) {
  const methodNotAllowed = async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
  };

  app.get("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = GroupsQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_query", "Invalid query", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 120,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const { limit, offset } = parsed.data;
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("groups")
      .select("id, name, level, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return fail(reply, 500, "groups_fetch_failed", "Failed to fetch groups", requestId);
    }

    return ok(reply, { items: data || [], limit, offset }, requestId);
  });

  app.post("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = GroupCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("groups")
      .insert({
        tenant_id: auth.tenant.id,
        name: parsed.data.name,
        level: parsed.data.level || null,
        normalized_name: normalizeGroupName(parsed.data.name),
      })
      .select("id, name, level, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return fail(reply, 409, "duplicate_group", "Group already exists", requestId);
      }
      return fail(reply, 500, "group_create_failed", "Failed to create group", requestId);
    }

    return created(reply, data, requestId);
  });

  app.put("/", methodNotAllowed);
  app.patch("/", methodNotAllowed);
  app.delete("/", methodNotAllowed);
  app.head("/", methodNotAllowed);
}
