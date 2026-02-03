import { makeRequestId } from "./_lib/requestId.js";
import { ok, created, fail } from "./_lib/http.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { requireRole } from "./_lib/middleware.js";
import { getTenantSlug } from "./_lib/tenantSlug.js";
import { createSupabaseAdmin } from "./_lib/supabase.js";
import {
  GroupsQuerySchema,
  GroupCreateSchema,
} from "./_lib/validators.js";

export default async function handler(req, res) {
  const requestId = makeRequestId();
  const tenantSlug = getTenantSlug(req);

  if (req.method === "GET") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = GroupsQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(res, 400, "invalid_query", "Invalid query", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 120,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

    const { limit, offset } = parsed.data;
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("groups")
      .select("id, name, level, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return fail(res, 500, "groups_fetch_failed", "Failed to fetch groups", requestId);
    }

    return ok(res, { items: data || [], limit, offset }, requestId);
  }

  if (req.method === "POST") {
    const auth = await requireRole(req, res, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = GroupCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    res.setHeader("x-ratelimit-limit", rl.limit);
    res.setHeader("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("groups")
      .insert({
        tenant_id: auth.tenant.id,
        name: parsed.data.name,
        level: parsed.data.level || null,
      })
      .select("id, name, level, created_at")
      .single();

    if (error) {
      return fail(res, 500, "group_create_failed", "Failed to create group", requestId);
    }

    return created(res, data, requestId);
  }

  return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
}
