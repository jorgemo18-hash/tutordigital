import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const EnsureGroupSchema = z.object({
  stage: z.enum(["eso", "bachiller", "bach"]),
  year: z.coerce.number().int().min(1).max(6),
  track: z.string().min(1).max(1).regex(/^[A-Za-z]$/),
});

function normalizeGroupName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function stageLabel(stage) {
  if (stage === "eso") return "ESO";
  return "Bachillerato";
}

function canonicalStage(stage) {
  return stage === "bach" ? "bachiller" : stage;
}

export default async function adminGroupsRoutes(app) {
  const security = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_GROUPS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_GROUPS_RATE_MAX",
    routeName: "admin-groups-ensure",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  app.post(
    "/admin/groups/ensure",
    { preHandler: [security.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, {
        tenantSlug,
        roles: ["admin"],
      });
      if (!auth.ok) return;

      const parsed = EnsureGroupSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
          issues: parsed.error.issues,
        });
      }

      const stage = canonicalStage(parsed.data.stage);
      const year = Number(parsed.data.year);
      const track = String(parsed.data.track).toUpperCase();

      const name = `${year}º ${stageLabel(stage)} ${track}`;
      const normalizedName = normalizeGroupName(name);
      const admin = createSupabaseAdmin();

      const { data: existing, error: findErr } = await admin
        .from("groups")
        .select("id, name, level, created_at")
        .eq("tenant_id", auth.tenant.id)
        .eq("normalized_name", normalizedName)
        .maybeSingle();

      if (findErr) {
        return fail(reply, 500, "groups_lookup_failed", "Failed to lookup groups", requestId);
      }
      if (existing?.id) return ok(reply, existing, requestId);

      const { data: createdRow, error: createErr } = await admin
        .from("groups")
        .insert({
          tenant_id: auth.tenant.id,
          name,
          level: stage,
          normalized_name: normalizedName,
        })
        .select("id, name, level, created_at")
        .single();

      if (createErr) {
        if (createErr.code === "23505") {
          const { data: raced, error: racedErr } = await admin
            .from("groups")
            .select("id, name, level, created_at")
            .eq("tenant_id", auth.tenant.id)
            .eq("normalized_name", normalizedName)
            .maybeSingle();
          if (!racedErr && raced?.id) return ok(reply, raced, requestId);
        }
        return fail(reply, 500, "group_create_failed", "Failed to create group", requestId);
      }

      return ok(reply, createdRow, requestId);
    }
  );
}
