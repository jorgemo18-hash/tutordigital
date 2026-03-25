import crypto from "node:crypto";
import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireAuth, getMembership } from "../../lib/auth.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";

const TenantJoinSchema = z.object({
  join_code: z.string().min(4).max(64),
  course: z.string().regex(/^(?:[1-6]P|[1-4]E|[12]B)$/),
});

function hashCode(code, envKey) {
  const pepper =
    process.env[envKey] ||
    process.env.JOIN_CODE_PEPPER ||
    process.env.INVITE_CODE_PEPPER ||
    "";
  return crypto.createHash("sha256").update(pepper + code).digest("hex");
}

function methodNotAllowed(reply, requestId) {
  return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
}

export default async function accessRoutes(app) {
  app.route({
    method: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"],
    url: "/tenant/join",
    handler: async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      if (req.method !== "POST") return methodNotAllowed(reply, requestId);

      // Flujo desactivado — los alumnos deben registrarse desde student-register.html
      return fail(reply, 410, "flow_disabled", "Este flujo está desactivado. Usa el enlace de registro de tu grupo.", requestId);

      const auth = await requireAuth(req);
      if (!auth.ok) return fail(reply, 401, "unauthorized", "Unauthorized", requestId);

      const parsed = TenantJoinSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
          issues: parsed.error.issues,
        });
      }

      const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const joinHash = hashCode(parsed.data.join_code.trim(), "JOIN_CODE_PEPPER");
      const { data: tenant, error: tenantErr } = await admin
        .from("tenants")
        .select("id, slug, name")
        .eq("join_code_hash", joinHash)
        .maybeSingle();

      if (tenantErr || !tenant) {
        return fail(reply, 400, "join_code_invalid", "Invalid join code", requestId);
      }

      const { membership } = await getMembership({ userId: auth.user.id, tenantId: tenant.id });
      if (membership && membership.role !== "student") {
        return fail(reply, 409, "role_conflict", "User already has a different role", requestId);
      }

      if (!membership) {
        const { error: membershipError } = await admin
          .from("tenant_memberships")
          .insert({
            tenant_id: tenant.id,
            user_id: auth.user.id,
            role: "student",
            status: "pending",
          });
        if (membershipError) {
          return fail(reply, 500, "membership_create_failed", "Failed to create membership", requestId);
        }
      }

      const { data: student, error: studentLookupError } = await admin
        .from("students")
        .select("id, approval_status")
        .eq("tenant_id", tenant.id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (studentLookupError) {
        return fail(reply, 500, "student_lookup_failed", "Failed to lookup student", requestId);
      }

      if (!student) {
        const { error: studentError } = await admin
          .from("students")
          .insert({
            tenant_id: tenant.id,
            user_id: auth.user.id,
            display_name: auth.user.email || "Alumno",
            status: "pending",
            approval_status: "pending",
          });
        if (studentError) {
          return fail(reply, 500, "student_create_failed", "Failed to create student", requestId);
        }
      }

      const approvalStatus = student?.approval_status || "pending";
      const membershipStatus = membership?.status || "pending";

      return ok(
        reply,
        {
          tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
          role: "student",
          membership_status: membershipStatus,
          approval_status: approvalStatus,
        },
        requestId
      );
    },
  });

  app.route({
    method: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"],
    url: "/student/status",
    handler: async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      if (req.method !== "GET") return methodNotAllowed(reply, requestId);

      const auth = await requireAuth(req);
      if (!auth.ok) return fail(reply, 401, "unauthorized", "Unauthorized", requestId);

      const tenantSlug = getTenantSlug(req);
      if (!tenantSlug) {
        return fail(reply, 400, "tenant_slug_required", "Tenant slug required", requestId);
      }

      const admin = createSupabaseAdmin();
      const { data: tenant, error: tenantErr } = await admin
        .from("tenants")
        .select("id, slug, name")
        .eq("slug", tenantSlug)
        .maybeSingle();
      if (tenantErr || !tenant) {
        return fail(reply, 404, "tenant_not_found", "Tenant not found", requestId);
      }

      const { membership } = await getMembership({ userId: auth.user.id, tenantId: tenant.id });
      if (!membership) {
        return fail(reply, 403, "tenant_forbidden", "Tenant forbidden", requestId);
      }
      if (membership.role !== "student") {
        return fail(reply, 403, "role_forbidden", "Role forbidden", requestId);
      }

      const rl = await rateLimit(req, {
        limit: 60,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: tenant.id,
      });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const { data: student, error: studentErr } = await admin
        .from("students")
        .select("id, display_name, group_id, approval_status, status")
        .eq("tenant_id", tenant.id)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (studentErr || !student) {
        return fail(reply, 404, "student_not_found", "Student not found", requestId);
      }

      return ok(reply, { student }, requestId);
    },
  });
}
