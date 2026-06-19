import { ok, fail } from "../../lib/http.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";

const IA_COST_PER_SESSION_EUR = 0.044; // estimación fija — no hay tracking de coste real por sesión

function firstDayOfMonthISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function superadminStatsRoutes(app) {

  // GET /api/v1/superadmin/stats — métricas globales de toda la plataforma
  app.get("/superadmin/stats", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const monthStart = firstDayOfMonthISO();

    const [tenantsRes, studentsRes, teachersRes, sessionsRes, escalationsRes] = await Promise.all([
      admin.from("tenants").select("id", { count: "exact", head: true })
        .eq("status", "active").is("deleted_at", null),
      admin.from("students").select("id", { count: "exact", head: true })
        .eq("approval_status", "approved"),
      admin.from("teacher_profiles").select("id", { count: "exact", head: true })
        .eq("is_active", true),
      admin.from("tutor_sessions").select("id", { count: "exact", head: true })
        .gte("session_date", monthStart),
      admin.from("tutor_sessions").select("id", { count: "exact", head: true })
        .eq("needs_help", true).gte("session_date", monthStart),
    ]);

    const failed = [tenantsRes, studentsRes, teachersRes, sessionsRes, escalationsRes].find(r => r.error);
    if (failed) {
      req.log.error({ requestId, err: failed.error }, "superadmin stats query failed");
      return fail(reply, 500, "stats_query_failed", "No se pudieron obtener las estadísticas", requestId);
    }

    const sesionesMes = sessionsRes.count || 0;

    return ok(reply, {
      centros_activos:   tenantsRes.count   || 0,
      alumnos_totales:    studentsRes.count  || 0,
      docentes_totales:   teachersRes.count  || 0,
      sesiones_mes:       sesionesMes,
      coste_ia_mes:       Math.round(sesionesMes * IA_COST_PER_SESSION_EUR * 100) / 100,
      tokens_mes:         null, // TODO: no existe tabla de consumo de tokens todavía
      escalaciones_mes:   escalationsRes.count || 0,
    }, requestId);
  });
}
