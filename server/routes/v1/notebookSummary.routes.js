import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { verificarGrupoVisible } from "../../lib/instituto/alumnosVisibles.js";
import { toIsoDateStart, toIsoDateEnd, statusForSummary } from "../../lib/notebook/resumen.js";

// GET /api/v1/notebook/summary — el cuaderno de UN grupo en un rango de
// fechas: sus alumnos, sus tareas, qué han entregado y qué dudas han
// escalado.
//
// SALIÓ DE notebook.routes.js el 09/09/2026, al añadirle la comprobación de
// visibilidad: aquel archivo llegaba a 380 líneas y son dos cosas distintas
// —el CRUD de notas de un alumno y el resumen agregado de un grupo—, así
// que la partición no es por tamaño, es por responsabilidad. Se registra en
// el MISMO prefijo (/api/v1/notebook), así que la URL no cambia.

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEBUG_NOTEBOOK = String(process.env.DEBUG_NOTEBOOK || "").toLowerCase() === "1";

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

function clean(v) {
  const s = String(v ?? "").trim();
  return s.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

const SummaryQuerySchema = z.object({
  group_id: z.string().uuid(),
  from: z.string().regex(YMD_RE),
  to: z.string().regex(YMD_RE),
});

function methodNotAllowed(req, reply) {
  return fail(reply, 405, "method_not_allowed", "Method not allowed", req.requestId || makeRequestId());
}

export default async function notebookSummaryRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();


  app.get("/summary", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const q = req.query || {};
    if (DEBUG_NOTEBOOK) {
      req.log.info(
        {
          requestId,
          raw: q,
          fromType: typeof q.from,
          toType: typeof q.to,
        },
        "[NOTEBOOK_SUMMARY][RAW]"
      );
    }

    const normalized = {
      group_id: clean(first(q.group_id)),
      from: clean(first(q.from)),
      to: clean(first(q.to)),
    };
    if (DEBUG_NOTEBOOK) req.log.info({ requestId, normalized }, "[NOTEBOOK_SUMMARY][NORM]");

    const parsed = SummaryQuerySchema.safeParse(normalized);
    if (!parsed.success) {
      if (DEBUG_NOTEBOOK) {
        req.log.info({ requestId, issues: parsed.error.issues }, "[NOTEBOOK_SUMMARY][INVALID]");
      }
      return reply.code(400).send({
        error: {
          code: "invalid_query",
          message: "Invalid query",
          issues: parsed.error.issues,
        },
        requestId: req.id || requestId,
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

    const admin = createSupabaseAdmin();
    const { group_id, from, to } = parsed.data;

    // El group_id llega del query: comprobar que EXISTA en el centro no
    // basta, hay que comprobar que sea de este profesor. Hasta el 09/09/2026
    // cualquier profesor sacaba el cuaderno entero de cualquier grupo
    // cambiando un parámetro de la URL.
    const grupoOk = await verificarGrupoVisible(admin, {
      role: auth.membership.role,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      grupoId: group_id,
    });
    if (!grupoOk.ok) {
      if (grupoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: grupoOk.error, requestId }, "notebook summary: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      // Mismo 404 que un grupo inexistente: un 403 confirmaría que ese grupo
      // existe en el centro y permitiría enumerarlos.
      return fail(reply, 404, "group_not_found", "Group not found", requestId);
    }

    const { data: group, error: groupErr } = await admin
      .from("groups")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", group_id)
      .maybeSingle();
    if (groupErr) {
      return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
    }
    if (!group) {
      return fail(reply, 404, "group_not_found", "Group not found", requestId);
    }

    const { data: students, error: studentsErr } = await admin
      .from("students")
      .select("id, display_name")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id);
    if (studentsErr) {
      return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
    }

    const { data: tasks, error: tasksErr } = await admin
      .from("tasks")
      .select("id, due_date")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id)
      .gte("due_date", from)
      .lte("due_date", to);
    if (tasksErr) {
      return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
    }

    const taskIds = (tasks || []).map((t) => t.id);
    const tasksTotal = taskIds.length;

    let statusRows = [];
    if (taskIds.length) {
      const { data: statusData, error: statusErr } = await admin
        .from("student_task_status")
        .select("student_id, status")
        .eq("tenant_id", auth.tenant.id)
        .in("task_id", taskIds);
      if (statusErr) {
        return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
      }
      statusRows = statusData || [];
    }

    const doneByStudent = new Map();
    statusRows.forEach((row) => {
      if (row.status !== "done") return;
      const prev = doneByStudent.get(row.student_id) || 0;
      doneByStudent.set(row.student_id, prev + 1);
    });

    const { data: tickets, error: ticketsErr } = await admin
      .from("tickets")
      .select("id, student_id, status, created_at")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id)
      .gte("created_at", toIsoDateStart(from))
      .lte("created_at", toIsoDateEnd(to));
    if (ticketsErr) {
      return fail(reply, 500, "notebook_summary_failed", "Failed to fetch notebook", requestId);
    }

    const openByStudent = new Map();
    const closedByStudent = new Map();
    (tickets || []).forEach((t) => {
      if (!t.student_id) return;
      if (t.status === "open") {
        openByStudent.set(t.student_id, (openByStudent.get(t.student_id) || 0) + 1);
      } else {
        closedByStudent.set(t.student_id, (closedByStudent.get(t.student_id) || 0) + 1);
      }
    });

    const studentsList = (students || []).map((s) => {
      const tasks_done = doneByStudent.get(s.id) || 0;
      const tickets_open = openByStudent.get(s.id) || 0;
      const tickets_closed = closedByStudent.get(s.id) || 0;
      return {
        student_id: s.id,
        name: s.display_name || "",
        tasks_total: tasksTotal,
        tasks_done,
        tickets_open,
        tickets_closed,
        status: statusForSummary({
          tasks_total: tasksTotal,
          tasks_done,
          ayudaPendiente: tickets_open,
        }),
      };
    });

    return ok(reply, { group_id, from, to, students: studentsList }, requestId);
  });

  app.put("/summary", methodNotAllowed);
  app.post("/summary", methodNotAllowed);
  app.patch("/summary", methodNotAllowed);
  app.delete("/summary", methodNotAllowed);
  app.head("/summary", methodNotAllowed);
}
