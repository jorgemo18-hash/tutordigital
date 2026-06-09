import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const TermDatesUpsertSchema = z.array(
  z.object({
    trimester: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  }).refine((o) => o.start_date < o.end_date, {
    message: "start_date must be before end_date",
  })
).length(3);

function defaultTermDates() {
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const academicStartYear = nowMonth >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const next = academicStartYear + 1;
  return [
    { trimester: 1, start_date: `${academicStartYear}-09-01`, end_date: `${academicStartYear}-12-31` },
    { trimester: 2, start_date: `${next}-01-01`, end_date: `${next}-03-31` },
    { trimester: 3, start_date: `${next}-04-01`, end_date: `${next}-06-30` },
  ];
}

export default async function termDatesRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // GET /term-dates — devuelve las 3 filas para el tenant activo (admin + teacher)
  app.get(
    "/",
    { preHandler: tenantMembershipGuard.preHandler },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, {
        tenantSlug,
        roles: ["admin", "teacher"],
      });
      if (!auth.ok) return;

      const rl = await rateLimit(req, {
        limit: 120,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: auth.tenant.id,
      });
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("term_dates")
        .select("trimester, start_date, end_date")
        .eq("tenant_id", auth.tenant.id)
        .order("trimester");

      if (error) {
        req.log.error({ requestId, error }, "term_dates GET failed");
        return fail(reply, 500, "db_error", "Failed to fetch term dates", requestId);
      }

      const rows = data && data.length === 3 ? data : defaultTermDates();
      return ok(reply, rows, requestId);
    }
  );

  // PUT /term-dates — upsert de los 3 trimestres (solo admin)
  app.put(
    "/",
    { preHandler: tenantMembershipGuard.preHandler },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, {
        tenantSlug,
        roles: ["admin"],
      });
      if (!auth.ok) return;

      const rl = await rateLimit(req, {
        limit: 30,
        windowSec: 60,
        userId: auth.user.id,
        tenantId: auth.tenant.id,
      });
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const parsed = TermDatesUpsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid term dates", requestId, {
          issues: parsed.error.issues,
        });
      }

      const rows = parsed.data.map((t) => ({
        tenant_id: auth.tenant.id,
        trimester: t.trimester,
        start_date: t.start_date,
        end_date: t.end_date,
        updated_at: new Date().toISOString(),
      }));

      const admin = createSupabaseAdmin();
      const { error } = await admin
        .from("term_dates")
        .upsert(rows, { onConflict: "tenant_id,trimester" });

      if (error) {
        req.log.error({ requestId, error }, "term_dates PUT failed");
        return fail(reply, 500, "db_error", "Failed to save term dates", requestId);
      }

      return ok(reply, { ok: true }, requestId);
    }
  );
}
