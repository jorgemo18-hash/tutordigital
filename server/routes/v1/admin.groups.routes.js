import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const EnsureGroupSchema = z.object({
  stage: z.enum(["primaria", "eso", "bachiller", "bach"]),
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
  if (stage === "primaria") return "Primaria";
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
      try {
        req.log.info({
          url: req.raw?.url || req.url,
          hasAuth: Boolean(req.headers.authorization),
          authPrefix: String(req.headers.authorization || "").slice(0, 15),
        }, "admin request headers");

        const requestId = req.requestId || makeRequestId();
        const tenantSlug = String(getTenantSlug(req) || "").trim();
        if (!tenantSlug) {
          return fail(reply, 400, "tenant_slug_required", "Tenant slug required", requestId);
        }

        const auth = await requireRole(req, reply, requestId, {
          tenantSlug,
          roles: ["admin"],
        });
        if (!auth.ok) return;
        if (!auth?.tenant?.id) {
          return fail(reply, 403, "tenant_forbidden", "Tenant forbidden", requestId);
        }

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

        let existing = null;
        let findErr = null;
        ({ data: existing, error: findErr } = await admin
          .from("groups")
          .select("id, name, level, created_at")
          .eq("tenant_id", auth.tenant.id)
          .eq("normalized_name", normalizedName)
          .maybeSingle());

        // Compat fallback: if DB doesn't have normalized_name yet, lookup by exact display name.
        if (findErr && (findErr.code === "42703" || String(findErr.message || "").includes("normalized_name"))) {
          ({ data: existing, error: findErr } = await admin
            .from("groups")
            .select("id, name, level, created_at")
            .eq("tenant_id", auth.tenant.id)
            .eq("name", name)
            .maybeSingle());
        }

        if (findErr) {
          req.log.error({ err: findErr, requestId }, "groups ensure lookup failed");
          return fail(reply, 500, "groups_lookup_failed", "Failed to lookup groups", requestId);
        }
        if (existing?.id) return ok(reply, existing, requestId);

        let createdRow = null;
        let createErr = null;
        ({ data: createdRow, error: createErr } = await admin
          .from("groups")
          .insert({
            tenant_id: auth.tenant.id,
            name,
            level: stage,
            normalized_name: normalizedName,
          })
          .select("id, name, level, created_at")
          .single());

        // Compat fallback: insert without normalized_name if column is missing.
        if (createErr && (createErr.code === "42703" || String(createErr.message || "").includes("normalized_name"))) {
          ({ data: createdRow, error: createErr } = await admin
            .from("groups")
            .insert({
              tenant_id: auth.tenant.id,
              name,
              level: stage,
            })
            .select("id, name, level, created_at")
            .single());
        }

        if (createErr) {
          if (createErr.code === "23505") {
            // On duplicate, retry lookup using compatible query strategy.
            let raced = null;
            let racedErr = null;
            ({ data: raced, error: racedErr } = await admin
              .from("groups")
              .select("id, name, level, created_at")
              .eq("tenant_id", auth.tenant.id)
              .eq("name", name)
              .maybeSingle());
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
}
