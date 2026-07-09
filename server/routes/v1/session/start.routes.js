import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { getEnv } from "../../../lib/env.js";
import { startSession } from "../../../lib/orchestrator/sessionLifecycle.js";
import { taskBelongsToStudent } from "../../../lib/taskOwnership.js";

const StartSchema = z.object({
  taskId: z.string().uuid(),
  mode:   z.string().max(40).optional(),
});

// ── POST /api/v1/session/start ─────────────────────────────────────────────
// Phase 1: detecta ejercicios. Devuelve 'needs_choice' (varios ejercicios)
// o 'ready' (uno solo, pasos generados directamente).
export function registerSessionStart(app, { guard }) {
  app.post("/start", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const parsed = StartSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin          = createSupabaseAdmin();
    const { taskId, mode } = parsed.data;

    const { data: student } = await admin
      .from("students")
      .select("id, group_id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!student) return fail(reply, 403, "not_student", "No student record found", requestId);

    // Verificar pertenencia antes de nada: sin esto, cualquier alumno del
    // tenant podía arrancar una sesión sobre la tarea de otro pasando su
    // UUID — solo se comprobaba que la tarea existiera en el tenant.
    const owned = await taskBelongsToStudent(admin, { tenantId: auth.tenant.id, taskId, student });
    if (!owned) return fail(reply, 403, "forbidden", "No tienes permiso sobre esta tarea.", requestId);

    // Tarea + adjuntos en un solo bloque
    const [{ data: task }, { data: attachmentRows }] = await Promise.all([
      admin.from("tasks").select("title, description, teacher_notes")
        .eq("id", taskId).eq("tenant_id", auth.tenant.id).maybeSingle(),
      admin.from("attachments").select("id, file_name, mime, storage_path, role")
        .eq("owner_type", "task").eq("owner_id", taskId),
    ]);

    if (!task) return fail(reply, 404, "task_not_found", "Task not found", requestId);

    const apiKey = getEnv("ANTHROPIC_API_KEY", "");
    if (!apiKey) return fail(reply, 500, "missing_config", "Missing AI configuration", requestId);

    try {
      const result = await startSession({
        studentId:   student.id,
        taskId,
        tenantId:    auth.tenant.id,
        taskContext: {
          title:        task.title         || "",
          description:  task.description   || "",
          teacherNotes: task.teacher_notes || "",
          attachments:  attachmentRows     || [],
        },
        mode: mode || "deberes",
        apiKey,
      });
      return ok(reply, result, requestId);
    } catch (err) {
      console.error("[session.start] Error:", err?.message);
      return fail(reply, 500, "session_failed", "Failed to start session", requestId);
    }
  });
}
