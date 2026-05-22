import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const GenerateSchema = z.object({
  student_id: z.string().uuid(),
  group_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export default async function reportsRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/generate", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = GenerateSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail(reply, 500, "missing_key", "AI service not configured", requestId);

    const admin = createSupabaseAdmin();
    const { student_id, group_id, from, to } = parsed.data;

    console.error("[reports] query params", JSON.stringify({ requestId, student_id, group_id, from, to, tenant_id: auth.tenant.id }));

    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("id, display_name, first_name, last_name")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", student_id)
      .eq("group_id", group_id)
      .maybeSingle();

    console.error("[reports] student lookup", JSON.stringify({ requestId, found: !!student, studentErr }));

    if (!student) return fail(reply, 404, "not_found", "Student not found", requestId);

    const [
      { data: sessions, error: sessErr },
      { data: grades, error: gradesErr },
      { data: tasks, error: tasksErr },
    ] = await Promise.all([
      admin
        .from("tutor_sessions")
        .select("task_id, duration_seconds, needs_help, session_date")
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", student_id)
        .gte("session_date", from)
        .lte("session_date", to),
      admin
        .from("grades")
        .select("title, score, date, task_id")
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", student_id)
        .gte("date", from)
        .lte("date", to),
      admin
        .from("tasks")
        .select("id, title, type, due_date")
        .eq("tenant_id", auth.tenant.id)
        .eq("group_id", group_id)
        .gte("due_date", from)
        .lte("due_date", to),
    ]);

    console.error("[reports] data fetch", JSON.stringify({ requestId, sessErr, gradesErr, tasksErr, sessionsCount: sessions?.length, gradesCount: grades?.length, tasksCount: tasks?.length }));

    const sessionList = sessions || [];
    const gradeList = grades || [];
    const totalTasks = (tasks || []).length;

    if (totalTasks === 0 && sessionList.length === 0 && gradeList.length === 0) {
      return fail(reply, 422, "no_data", "No hay datos suficientes para generar el informe en este periodo", requestId);
    }

    const studentName =
      student.display_name ||
      `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
      "El alumno";

    const totalSecs = sessionList.reduce((s, r) => s + (r.duration_seconds || 0), 0);
    const totalMins = Math.round(totalSecs / 60);

    // Per-task latest session to determine outcome
    const latestByTask = new Map();
    sessionList.forEach(s => {
      const prev = latestByTask.get(s.task_id);
      if (!prev || (s.session_date && s.session_date >= prev.session_date)) {
        latestByTask.set(s.task_id, s);
      }
    });
    const solvedAlone = [...latestByTask.values()].filter(s => !s.needs_help).length;
    const neededHelp = [...latestByTask.values()].filter(s => s.needs_help).length;

    const gradesText = gradeList.length
      ? gradeList.map(g => `${g.title}: ${g.score}`).join(", ")
      : "sin notas registradas";

    const prompt = `Redacta un párrafo breve (4-5 frases) sobre el rendimiento de ${studentName} entre ${from} y ${to}.

Datos del periodo:
- Total de tareas del grupo: ${totalTasks}
- Tiempo total con el tutor digital: ${totalMins} minutos
- Tareas resueltas de forma autónoma: ${solvedAlone}
- Tareas en que necesitó apoyo extra: ${neededHelp}
- Calificaciones: ${gradesText}

Escribe en español, con tono profesional y constructivo para comunicar a familias o incluir en boletines. Solo prosa, sin listas ni encabezados.`;

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-opus-4-6",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
      });
      const text = response.content.find(b => b.type === "text")?.text || "";
      return ok(reply, { narrative: text.trim() }, requestId);
    } catch {
      return fail(reply, 500, "ai_error", "Failed to generate report", requestId);
    }
  });
}
