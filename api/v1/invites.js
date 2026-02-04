import crypto from "crypto";
import { z } from "zod";
import { makeRequestId } from "./_lib/requestId.js";
import { ok, created, fail } from "./_lib/http.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { requireRole } from "./_lib/middleware.js";
import { getTenantSlug } from "./_lib/tenantSlug.js";
import { createSupabaseAdmin } from "./_lib/supabase.js";

const InviteCreateSchema = z.object({
  group_id: z.string().uuid(),
  role: z.enum(["student"]).default("student"),
  expires_in_days: z.coerce.number().int().min(1).max(365).optional(),
  max_uses: z.coerce.number().int().min(1).max(50).optional(),
});

function generateCode() {
  return crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();
}

function hashCode(code) {
  const pepper = process.env.INVITE_CODE_PEPPER || "";
  return crypto.createHash("sha256").update(pepper + code).digest("hex");
}

export default async function handler(req, res) {
  const requestId = makeRequestId();
  const tenantSlug = getTenantSlug(req);

  if (req.method !== "POST") {
    return fail(res, 405, "method_not_allowed", "Method not allowed", requestId);
  }

  const auth = await requireRole(req, res, requestId, {
    tenantSlug,
    roles: ["admin", "teacher"],
  });
  if (!auth.ok) return;

  const parsed = InviteCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 400, "invalid_body", "Invalid body", requestId, {
      issues: parsed.error.issues,
    });
  }

  const rl = await rateLimit(req, {
    limit: 30,
    windowSec: 60,
    userId: auth.user.id,
    tenantId: auth.tenant.id,
  });
  res.setHeader("x-ratelimit-limit", rl.limit);
  res.setHeader("x-ratelimit-remaining", rl.remaining);
  if (!rl.ok) return fail(res, 429, "rate_limited", "Too many requests", requestId);

  const admin = createSupabaseAdmin();
  const groupCheck = await admin
    .from("groups")
    .select("id")
    .eq("tenant_id", auth.tenant.id)
    .eq("id", parsed.data.group_id)
    .maybeSingle();
  if (!groupCheck.data) {
    return fail(res, 404, "group_not_found", "Group not found", requestId);
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresInDays = parsed.data.expires_in_days || 30;
  const maxUses = parsed.data.max_uses || 1;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("invites")
    .insert({
      tenant_id: auth.tenant.id,
      role: parsed.data.role,
      code_hash: codeHash,
      expires_at: expiresAt,
      max_uses: maxUses,
      used_count: 0,
      group_id: parsed.data.group_id,
    })
    .select("id, expires_at, max_uses")
    .single();

  if (error) {
    return fail(res, 500, "invite_create_failed", "Failed to create invite", requestId);
  }

  return created(res, {
    code,
    invite_id: data?.id,
    expires_at: data?.expires_at || expiresAt,
    max_uses: data?.max_uses || maxUses,
  }, requestId);
}
