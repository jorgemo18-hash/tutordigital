import { ok, fail } from "../../lib/http.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";
import { usdToEur } from "../../lib/aiPricing.js";

const PERIODS = ["7d", "month", "year", "all"];

// Mapa modo (donut de estadisticas.js) -> tasks.type real. sesion_libre es
// un tipo de tarea real (ver auditoría 2026-07-27) — porción propia, nunca
// agrupada en "otros": agruparla la haría invisible justo cuando interese
// medirla.
const MODE_TASK_TYPES = { DEBERES: "homework", EXAMEN: "exam", TRABAJO: "work", SESION_LIBRE: "sesion_libre" };

// null para "all" (sin límite inferior — todo el histórico). Devuelve
// timestamptz ISO completo; quien filtre tutor_sessions.session_date (tipo
// `date`, no timestamptz) debe usar solo la parte de fecha (ver
// periodStartDateOnly).
function periodStartISO(period) {
  const now = new Date();
  if (period === "7d") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString();
  }
  if (period === "year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  if (period === "all") return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(); // "month" (default)
}

function periodStartDateOnly(iso) {
  return iso ? iso.slice(0, 10) : null;
}

// Suma en JS, no en SQL: con el volumen real de hoy (unas pocas filas al
// mes, ver el comentario de granularidad en la migración 100_ai_token_usage)
// no compensa la complejidad de una función agregada en Postgres. Si el
// volumen crece mucho, revisar esto antes que el `head:true`/count de las
// demás métricas de esta ruta — es el primer sitio que dejaría de escalar.
function sumTokenUsage(rows = []) {
  // Sin ninguna fila este periodo (tracking activo, consumo real cero):
  // coste conocido y es 0, no "desconocido" — costConocido arranca en true
  // solo en ese caso vacío. Con filas presentes, depende de que al menos
  // una tenga cost_usd calculable (ver el comentario de más abajo).
  let inputTokens = 0, outputTokens = 0, costUsd = 0, costEur = 0, costConocido = rows.length === 0;
  for (const r of rows) {
    inputTokens  += r.input_tokens  || 0;
    outputTokens += r.output_tokens || 0;
    // cost_usd es NULL en una fila cuando el modelo de esa llamada no
    // estaba en la tabla de precios (ver aiPricing.js) — se suma solo lo
    // conocido, así que el coste puede infravalorar ligeramente en vez de
    // bloquear el número entero por una fila sin precio. El EUR se deriva
    // fila a fila con SU PROPIO fx_usd_eur congelado — nunca sumar cost_usd
    // y multiplicar por el tipo de cambio de HOY, eso reintroduciría el
    // recálculo retroactivo que todo este diseño evita (ver aiPricing.js).
    if (r.cost_usd != null) {
      costUsd += r.cost_usd;
      const rowEur = usdToEur(r.cost_usd, r.fx_usd_eur);
      if (rowEur != null) costEur += rowEur;
      costConocido = true;
    }
  }
  return { inputTokens, outputTokens, costUsd: costConocido ? costUsd : null, costEur: costConocido ? costEur : null };
}

// Decisión "sin datos" vs "0 real" vs "periodo parcial", separada de las
// queries para poder testearla sin Fastify ni Supabase de por medio.
// trackingDesde: created_at de la primera fila jamás escrita en
// ai_token_usage para este filtro (o null si no hay ninguna). periodStartISO:
// inicio del periodo que se está reportando (null = "all", sin límite).
export function buildTokenStats({ trackingDesde, periodStartISO, tokenUsageRows }) {
  // Sin ninguna fila jamás: la función no ha capturado nada todavía (recién
  // desplegada, sin tráfico de IA desde entonces, o el tenant filtrado no
  // tiene ninguna) — null, no 0.
  const tokensDisponibles = trackingDesde !== null && trackingDesde !== undefined;
  // Tracking empezó DENTRO de este periodo (no antes): los números son
  // reales pero parciales, no representan el periodo completo. Con
  // periodStartISO null ("all"), nunca es parcial — no hay límite contra el
  // que comparar, todo el histórico disponible ya está incluido.
  const periodoParcial = tokensDisponibles && periodStartISO !== null && trackingDesde > periodStartISO;

  const { inputTokens, outputTokens, costUsd, costEur } = tokensDisponibles
    ? sumTokenUsage(tokenUsageRows)
    : { inputTokens: 0, outputTokens: 0, costUsd: null, costEur: null };

  return {
    tokens_input_mes:   tokensDisponibles ? inputTokens  : null,
    tokens_output_mes:  tokensDisponibles ? outputTokens : null,
    tokens_mes:         tokensDisponibles ? inputTokens + outputTokens : null,
    coste_ia_mes:       tokensDisponibles ? costEur : null,
    // USD además del EUR mostrado en el panel: es el coste exacto según la
    // tarifa de Anthropic, sin conversión de por medio — cuadrar con la
    // factura real es directo con este número (ver aiPricing.js).
    coste_ia_mes_usd:   tokensDisponibles ? costUsd : null,
    tokens_tracking_desde:  tokensDisponibles ? trackingDesde : null,
    tokens_periodo_parcial: periodoParcial,
  };
}

// unique_students + modes + sessions_by_day, las tres derivadas del mismo
// fetch de filas de tutor_sessions (no de tres queries separadas) — JS-side,
// mismo criterio y misma advertencia de escala que sumTokenUsage: con el
// volumen real de hoy (unas pocas sesiones) no compensa una agregación SQL:
// si el volumen crece mucho, revisar esto junto con sumTokenUsage.
// `includeDaily`: false para "year"/"all" — un histograma diario sobre un
// rango sin acotar es justo el tipo de gráfico que no se sostiene con
// volumen real; para esos periodos se devuelven los KPI (unique_students,
// modes) pero no el desglose por día.
export function buildSessionBreakdown(sessionRows = [], taskTypeById = new Map(), includeDaily) {
  const uniqueStudents = new Set(sessionRows.map(r => r.student_id).filter(Boolean)).size;

  const modes = Object.fromEntries(Object.keys(MODE_TASK_TYPES).map(k => [k, 0]));
  for (const r of sessionRows) {
    const type = taskTypeById.get(r.task_id);
    const modeKey = Object.keys(MODE_TASK_TYPES).find(k => MODE_TASK_TYPES[k] === type);
    if (modeKey) modes[modeKey] += 1;
  }

  let sessionsByDay = null;
  if (includeDaily) {
    const byDay = new Map();
    for (const r of sessionRows) {
      if (!r.session_date) continue;
      byDay.set(r.session_date, (byDay.get(r.session_date) || 0) + 1);
    }
    sessionsByDay = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count }));
  }

  return { uniqueStudents, modes, sessionsByDay };
}

export default async function superadminStatsRoutes(app) {

  // GET /api/v1/superadmin/stats?period=7d|month|year|all&tenant_id=<uuid>
  // period/tenant_id opcionales — sin ellos, comportamiento idéntico al de
  // siempre (mes actual, todos los centros), así que el dashboard "Inicio"
  // y la tab "Stats" móvil (que nunca mandan estos params) no cambian.
  app.get("/superadmin/stats", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const period   = PERIODS.includes(req.query?.period) ? req.query.period : "month";
    const tenantId = req.query?.tenant_id || null;

    const startISO      = periodStartISO(period);
    const startDateOnly = periodStartDateOnly(startISO);

    // centros_activos/alumnos_totales/docentes_totales son conceptos
    // siempre globales (el dashboard "Inicio") — tenant_id nunca los filtra.
    const [tenantsRes, studentsRes, teachersRes] = await Promise.all([
      admin.from("tenants").select("id", { count: "exact", head: true })
        .eq("status", "active").is("deleted_at", null),
      // Mismo criterio que el panel admin (admin.dashboard.routes.js):
      // tabla students, approval_status = "approved".
      admin.from("students").select("id", { count: "exact", head: true })
        .eq("approval_status", "approved"),
      admin.from("teacher_profiles").select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    let sessionsQ    = admin.from("tutor_sessions").select("id", { count: "exact", head: true });
    let escalationsQ = admin.from("tutor_sessions").select("id", { count: "exact", head: true }).eq("needs_help", true);
    let sessionRowsQ = admin.from("tutor_sessions").select("student_id, task_id, session_date");
    let tokenUsageQ  = admin.from("ai_token_usage").select("input_tokens, output_tokens, cost_usd, fx_usd_eur");
    let trackingQ    = admin.from("ai_token_usage").select("created_at").order("created_at", { ascending: true }).limit(1);

    if (startDateOnly) {
      sessionsQ    = sessionsQ.gte("session_date", startDateOnly);
      escalationsQ = escalationsQ.gte("session_date", startDateOnly);
      sessionRowsQ = sessionRowsQ.gte("session_date", startDateOnly);
    }
    if (startISO) {
      tokenUsageQ = tokenUsageQ.gte("created_at", startISO);
      trackingQ   = trackingQ.gte("created_at", startISO);
    }
    if (tenantId) {
      sessionsQ    = sessionsQ.eq("tenant_id", tenantId);
      escalationsQ = escalationsQ.eq("tenant_id", tenantId);
      sessionRowsQ = sessionRowsQ.eq("tenant_id", tenantId);
      tokenUsageQ  = tokenUsageQ.eq("tenant_id", tenantId);
      trackingQ    = trackingQ.eq("tenant_id", tenantId);
    }

    const [sessionsRes, escalationsRes, sessionRowsRes, tokenUsageRes, trackingStartRes] = await Promise.all([
      sessionsQ, escalationsQ, sessionRowsQ, tokenUsageQ, trackingQ.maybeSingle(),
    ]);

    const failed = [tenantsRes, studentsRes, teachersRes, sessionsRes, escalationsRes, sessionRowsRes, tokenUsageRes, trackingStartRes].find(r => r.error);
    if (failed) {
      req.log.error({ requestId, err: failed.error }, "superadmin stats query failed");
      return fail(reply, 500, "stats_query_failed", "No se pudieron obtener las estadísticas", requestId, undefined, failed.error);
    }

    // Tipos de las tareas referenciadas por las sesiones del periodo, para
    // resolver `modes` — segunda query pequeña en vez de un embed
    // (!inner) sobre tutor_sessions: mismo criterio JS-side que el resto de
    // esta ruta, sin depender de sintaxis de filtro embebido sin probar aquí.
    const taskIds = [...new Set((sessionRowsRes.data || []).map(r => r.task_id).filter(Boolean))];
    const tasksRes = taskIds.length
      ? await admin.from("tasks").select("id, type").in("id", taskIds)
      : { data: [] };
    if (tasksRes.error) {
      req.log.error({ requestId, err: tasksRes.error }, "superadmin stats query failed");
      return fail(reply, 500, "stats_query_failed", "No se pudieron obtener las estadísticas", requestId, undefined, tasksRes.error);
    }
    const taskTypeById = new Map((tasksRes.data || []).map(t => [t.id, t.type]));

    const includeDaily = period === "7d" || period === "month";
    const { uniqueStudents, modes, sessionsByDay } = buildSessionBreakdown(sessionRowsRes.data, taskTypeById, includeDaily);

    const tokenStats = buildTokenStats({
      trackingDesde:   trackingStartRes.data?.created_at || null,
      periodStartISO:  startISO,
      tokenUsageRows:  tokenUsageRes.data,
    });

    return ok(reply, {
      centros_activos:   tenantsRes.count   || 0,
      alumnos_totales:    studentsRes.count  || 0,
      docentes_totales:   teachersRes.count  || 0,
      sesiones_mes:       sessionsRes.count || 0,
      // null cuando no hay ningún dato de consumo real todavía para este
      // periodo — nunca 0 disfrazado de consumo real (ver migración 100 y
      // aiPricing.js: coste_ia_mes ya no es sesiones_mes × constante fija).
      ...tokenStats,
      escalaciones_mes:   escalationsRes.count || 0,
      unique_students:    uniqueStudents,
      modes,
      sessions_by_day:    sessionsByDay,
    }, requestId);
  });
}
