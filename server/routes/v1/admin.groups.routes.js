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
  track: z.string().min(1).max(16),
  name: z.string().trim().min(1).max(96).optional(),
  level: z.string().trim().min(1).max(32).optional(),
  normalized_name: z.string().trim().min(3).max(128).optional(),
});

function normalizeGroupName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeTrack(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .replace(/\s/g, "-")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16);
}

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
        const track = normalizeTrack(parsed.data.track);
        if (!track || !/^[A-Z0-9_-]{1,16}$/.test(track)) {
          return fail(reply, 400, "invalid_track", "Invalid track", requestId);
        }

        const name = String(parsed.data.name || `${year}º ${stageLabel(stage)} - ${track}`).trim();
        const normalizedName = String(
          parsed.data.normalized_name || normalizedGroupKey(stage, year, track)
        ).toLowerCase();
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
            level: String(parsed.data.level || stage),
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
              level: String(parsed.data.level || stage),
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

            // Secondary retry by normalized_name when available.
            ({ data: raced, error: racedErr } = await admin
              .from("groups")
              .select("id, name, level, created_at")
              .eq("tenant_id", auth.tenant.id)
              .eq("normalized_name", normalizedName)
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
