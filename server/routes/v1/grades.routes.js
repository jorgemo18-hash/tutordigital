import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import {
  resolverAlumnoIdsVisibles, verificarAlumnoVisible, verificarGrupoVisible,
} from "../../lib/instituto/alumnosVisibles.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const BulkGradeSchema = z.object({
  task_id: z.string().uuid(),
  grades: z.array(z.object({
    student_id: z.string().uuid(),
    score: z.string().max(50),
  })).min(1).max(500),
});

const PostGradeSchema = z.object({
  task_id: z.string().uuid().optional(),
  student_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  score: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const PatchGradeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  score: z.string().min(1).max(50).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Guarda local: seis puntos de entrada comparten la misma comprobación
// ("¿este alumno es de un grupo de este profesor?") y repetirla seis veces
// es garantizar que una de las seis se quede vieja. Devuelve la respuesta ya
// enviada cuando hay que cortar, o null para seguir.
//
// LAS NOTAS SON EL EXPEDIENTE DEL ALUMNO. Hasta el 09/09/2026 todo esto
// filtraba solo por centro: cualquier profesor leía, ponía, cambiaba y
// borraba las calificaciones de cualquier alumno del instituto.
//
// `codigo404` para los sitios donde el id se puede ir probando: un 403
// confirma que esa fila existe y permite enumerar. Donde el id lo ha
// escrito el propio profesor (crear una nota) un 403 explicado es mejor,
// porque es un error suyo y tiene que entenderlo.
async function bloqueoPorAlumno(admin, { auth, alumnoId, req, reply, requestId, donde, codigo404 = false }) {
  const r = await verificarAlumnoVisible(admin, {
    role: auth.membership.role,
    tenantId: auth.tenant.id,
    tenantSlug: auth.tenant.slug,
    userId: auth.user.id,
    email: auth.user.email || "",
    alumnoId,
  });
  if (r.ok) return null;
  if (r.code === "visibilidad_fetch_failed") {
    req.log.error({ err: r.error, requestId }, `grades ${donde}: fallo resolviendo visibilidad`);
    return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
  }
  return codigo404
    ? fail(reply, 404, "not_found", "Grade not found", requestId)
    : fail(reply, 403, "forbidden", "Ese alumno no es de tus grupos", requestId);
}

export default async function gradesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET / — by task_id OR by group_id+from+to
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    if (req.query.task_id) {
      const taskId = String(req.query.task_id || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return fail(reply, 400, "invalid_query", "Invalid task_id", requestId);

      // Una tarea es de un grupo, pero las notas se piden por tarea: hay que
      // acotar a los alumnos que este profesor puede ver.
      const { alumnoIds, error: visErr } = await resolverAlumnoIdsVisibles(admin, {
        role: auth.membership.role,
        tenantId: auth.tenant.id,
        tenantSlug: auth.tenant.slug,
        userId: auth.user.id,
        email: auth.user.email || "",
      });
      if (visErr) {
        req.log.error({ err: visErr, requestId }, "grades GET task_id: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      if (Array.isArray(alumnoIds) && !alumnoIds.length) return ok(reply, [], requestId);

      let q = admin
        .from("grades")
        .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
        .eq("tenant_id", auth.tenant.id)
        .eq("task_id", taskId);
      if (Array.isArray(alumnoIds)) q = q.in("student_id", alumnoIds);

      const { data, error } = await q.order("date", { ascending: false });

      if (error) return fail(reply, 500, "db_error", "Failed to fetch grades", requestId);
      return ok(reply, data || [], requestId);
    }

    const groupId = String(req.query.group_id || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    if (!groupId || !from || !to) return fail(reply, 400, "invalid_query", "group_id, from and to are required", requestId);

    const grupoOk = await verificarGrupoVisible(admin, {
      role: auth.membership.role,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      grupoId: groupId,
    });
    if (!grupoOk.ok) {
      if (grupoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: grupoOk.error, requestId }, "grades GET group_id: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      return ok(reply, [], requestId);
    }

    const { data: students } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("group_id", groupId);

    if (!students?.length) return ok(reply, [], requestId);

    const studentIds = students.map(s => s.id);
    const { data, error } = await admin
      .from("grades")
      .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
      .eq("tenant_id", auth.tenant.id)
      .in("student_id", studentIds)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });

    if (error) return fail(reply, 500, "db_error", "Failed to fetch grades", requestId);
    return ok(reply, data || [], requestId);
  });

  // POST / — create grade
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = PostGradeSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.student_id)
      .maybeSingle();

    if (!student) return fail(reply, 404, "not_found", "Student not found", requestId);

    const bloqueo = await bloqueoPorAlumno(admin, {
      auth, alumnoId: parsed.data.student_id, req, reply, requestId, donde: "POST",
    });
    if (bloqueo) return bloqueo;

    const { data, error } = await admin
      .from("grades")
      .insert({
        tenant_id: auth.tenant.id,
        teacher_id: auth.user.id,
        student_id: parsed.data.student_id,
        task_id: parsed.data.task_id || null,
        title: parsed.data.title,
        score: parsed.data.score,
        date: parsed.data.date,
      })
      .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
      .single();

    if (error) return fail(reply, 500, "db_error", "Failed to save grade", requestId);
    return created(reply, data, requestId);
  });

  // PATCH /:id — update grade
  app.patch("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const gradeId = String(req.params.id || "").trim();
    if (!gradeId) return fail(reply, 400, "invalid_param", "Missing id", requestId);

    const parsed = PatchGradeSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const updates = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.score !== undefined) updates.score = parsed.data.score;
    if (parsed.data.date !== undefined) updates.date = parsed.data.date;
    if (!Object.keys(updates).length) return fail(reply, 400, "no_updates", "Nothing to update", requestId);

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { data: fila } = await admin
      .from("grades")
      .select("student_id")
      .eq("id", gradeId)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (!fila) return fail(reply, 404, "not_found", "Grade not found", requestId);

    const bloqueo = await bloqueoPorAlumno(admin, {
      auth, alumnoId: fila.student_id, req, reply, requestId, donde: "PATCH", codigo404: true,
    });
    if (bloqueo) return bloqueo;

    const { data, error } = await admin
      .from("grades")
      .update(updates)
      .eq("id", gradeId)
      .eq("tenant_id", auth.tenant.id)
      .select("id, student_id, teacher_id, task_id, title, score, date, created_at")
      .single();

    if (error) return fail(reply, 500, "db_error", "Failed to update grade", requestId);
    if (!data) return fail(reply, 404, "not_found", "Grade not found", requestId);
    return ok(reply, data, requestId);
  });

  // PATCH /bulk — upsert grades for all students in a task
  app.patch("/bulk", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const parsed = BulkGradeSchema.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { task_id, grades } = parsed.data;

    // Verify task belongs to tenant
    const { data: task } = await admin
      .from("tasks")
      .select("id, title")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", task_id)
      .maybeSingle();

    if (!task) return fail(reply, 404, "not_found", "Task not found", requestId);

    const today = new Date().toISOString().slice(0, 10);
    const nonEmpty = grades.filter(g => g.score.trim() !== "");
    if (!nonEmpty.length) return ok(reply, { saved: 0 }, requestId);

    // Verify every student_id belongs to the tenant before inserting any
    // grade — same check POST / already does per-request, batched here
    // since /bulk can carry many entries at once.
    const studentIds = [...new Set(nonEmpty.map(g => g.student_id))];
    const { data: validStudents } = await admin
      .from("students")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .in("id", studentIds);
    let validStudentIds = new Set((validStudents || []).map(s => s.id));

    // Y además, del profesor: "del centro" no basta (09/09/2026). El lote se
    // presta a colar un id ajeno entre veinte legítimos, y aquí se está
    // ESCRIBIENDO nota. Se intersecan los dos conjuntos y las entradas que
    // sobran se saltan igual que las de un alumno inexistente — el bucle de
    // abajo ya sabe hacer eso.
    const { alumnoIds, error: visErr } = await resolverAlumnoIdsVisibles(admin, {
      role: auth.membership.role,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
    });
    if (visErr) {
      req.log.error({ err: visErr, requestId }, "grades bulk: fallo resolviendo visibilidad");
      return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
    }
    if (Array.isArray(alumnoIds)) {
      const visibles = new Set(alumnoIds);
      validStudentIds = new Set([...validStudentIds].filter((id) => visibles.has(id)));
    }

    // For each entry: check if grade exists, then update or insert
    let saved = 0;
    for (const entry of nonEmpty) {
      if (!validStudentIds.has(entry.student_id)) continue;

      const { data: existing } = await admin
        .from("grades")
        .select("id")
        .eq("tenant_id", auth.tenant.id)
        .eq("task_id", task_id)
        .eq("student_id", entry.student_id)
        .maybeSingle();

      if (existing) {
        const { error } = await admin
          .from("grades")
          .update({ score: entry.score.trim() })
          .eq("id", existing.id)
          .eq("tenant_id", auth.tenant.id);
        if (!error) saved++;
      } else {
        const { error } = await admin
          .from("grades")
          .insert({
            tenant_id: auth.tenant.id,
            teacher_id: auth.user.id,
            student_id: entry.student_id,
            task_id,
            title: task.title,
            score: entry.score.trim(),
            date: today,
          });
        if (!error) saved++;
      }
    }

    return ok(reply, { saved }, requestId);
  });

  // DELETE /:id — remove grade
  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin", "teacher"] });
    if (!auth.ok) return;

    const gradeId = String(req.params.id || "").trim();
    if (!gradeId) return fail(reply, 400, "invalid_param", "Missing id", requestId);

    const rl = await rateLimit(req, { limit: 30, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    const { data: fila } = await admin
      .from("grades")
      .select("student_id")
      .eq("id", gradeId)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (!fila) return fail(reply, 404, "not_found", "Grade not found", requestId);

    const bloqueo = await bloqueoPorAlumno(admin, {
      auth, alumnoId: fila.student_id, req, reply, requestId, donde: "DELETE", codigo404: true,
    });
    if (bloqueo) return bloqueo;

    const { error } = await admin
      .from("grades")
      .delete()
      .eq("id", gradeId)
      .eq("tenant_id", auth.tenant.id);

    if (error) return fail(reply, 500, "db_error", "Failed to delete grade", requestId);
    return ok(reply, { ok: true }, requestId);
  });
}
