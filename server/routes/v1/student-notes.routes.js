import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { verificarGrupoVisible, verificarAlumnoVisible } from "../../lib/instituto/alumnosVisibles.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const PostNoteSchema = z.object({
  session_id: z.string().uuid(),
  note_text:  z.string().min(1).max(2000),
});

const GetNotesSchema = z.object({
  group_id: z.string().uuid(),
  from:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export default async function studentNotesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // ── POST / — alumno guarda una nota para el profesor ─────────────────────
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["student"] });
    if (!auth.ok) return;

    const parsed = PostNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 10, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { session_id, note_text } = parsed.data;

    // Obtener alumno
    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!student) return fail(reply, 403, "not_student", "No student record", requestId);

    // Verificar que la sesión pertenece al alumno
    const { data: sessionRow } = await admin
      .from("tutor_sessions")
      .select("id, task_id, student_id")
      .eq("id", session_id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (!sessionRow) return fail(reply, 403, "session_forbidden", "Session not found or forbidden", requestId);

    // Obtener group_id del alumno
    const { data: studentFull } = await admin
      .from("students")
      .select("group_id")
      .eq("id", student.id)
      .maybeSingle();

    // No permitir duplicados por sesión
    const { data: existing } = await admin
      .from("student_notes")
      .select("id")
      .eq("session_id", session_id)
      .maybeSingle();

    if (existing) return fail(reply, 409, "note_exists", "Ya existe una nota para esta sesión", requestId);

    const { data: note, error } = await admin.from("student_notes").insert({
      session_id,
      task_id:    sessionRow.task_id,
      student_id: student.id,
      group_id:   studentFull?.group_id || null,
      note_text,
    }).select("id, created_at").single();

    if (error) {
      console.error("[student-notes.POST] db error:", error?.message, error?.code, error?.details);
      return fail(reply, 500, "db_error", "Failed to save note", requestId);
    }

    return ok(reply, { id: note.id, created_at: note.created_at }, requestId);
  });

  // ── GET / — profesor obtiene notas no leídas de su grupo en un rango ────
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["teacher", "admin"] });
    if (!auth.ok) return;

    const parsed = GetNotesSchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(reply, 400, "invalid_query", "Invalid query params", requestId, { issues: parsed.error.issues });
    }

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { group_id, from, to } = parsed.data;

    // EL group_id VIENE DEL QUERY, así que hay que comprobar que sea de este
    // profesor. Sin esto, cualquier profesor del centro leía las notas de
    // cualquier grupo cambiando un parámetro de la URL (09/09/2026).
    const grupoOk = await verificarGrupoVisible(admin, {
      role: auth.membership.role,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      grupoId: group_id,
    });
    if (!grupoOk.ok) {
      if (grupoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: grupoOk.error, requestId }, "student-notes GET: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      // Lista vacía, como si el grupo no tuviera notas: no se confirma que
      // ese grupo exista en el centro.
      return ok(reply, [], requestId);
    }

    // Obtener alumnos del grupo
    const { data: students } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", group_id);

    if (!students?.length) return ok(reply, [], requestId);

    const studentIds = students.map(s => s.id);

    // Obtener notas en el rango por sesión_date del tutor_session asociado
    const { data: notes, error } = await admin
      .from("student_notes")
      .select("id, session_id, task_id, student_id, note_text, is_read, created_at")
      .in("student_id", studentIds)
      .gte("created_at", from + "T00:00:00")
      .lte("created_at", to   + "T23:59:59");

    if (error) return fail(reply, 500, "db_error", "Failed to fetch notes", requestId);

    return ok(reply, notes || [], requestId);
  });

  // ── PATCH /:noteId — profesor marca nota como leída ──────────────────────
  app.patch("/:noteId", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId  = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["teacher", "admin"] });
    if (!auth.ok) return;

    const { noteId } = req.params;
    if (!noteId) return fail(reply, 400, "missing_param", "Missing noteId", requestId);

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    // Verificar que la nota es de un alumno del tenant del profesor
    const { data: note } = await admin
      .from("student_notes")
      .select("id, session_id, student_id")
      .eq("id", noteId)
      .maybeSingle();

    if (!note) return fail(reply, 404, "not_found", "Note not found", requestId);

    const { data: sessionRow } = await admin
      .from("tutor_sessions")
      .select("tenant_id")
      .eq("id", note.session_id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!sessionRow) return fail(reply, 403, "forbidden", "Note not accessible", requestId);

    // Y que el ALUMNO sea de un grupo suyo, no solo del mismo centro: marcar
    // como leída la nota de un alumno ajeno se la esconde a quien sí tenía
    // que leerla, que es su profesor de verdad.
    const alumnoOk = await verificarAlumnoVisible(admin, {
      role: auth.membership.role,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      alumnoId: note.student_id,
    });
    if (!alumnoOk.ok) {
      if (alumnoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: alumnoOk.error, requestId }, "student-notes PATCH: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      return fail(reply, 403, "forbidden", "Note not accessible", requestId);
    }

    await admin.from("student_notes").update({ is_read: true }).eq("id", noteId);

    return ok(reply, { ok: true }, requestId);
  });
}
