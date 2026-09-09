import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { verificarAlumnoVisible } from "../../lib/instituto/alumnosVisibles.js";
import {
  NotebookQuerySchema,
  NotebookCreateSchema,
  NotebookPatchSchema,
} from "../../lib/validators.js";

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

async function getStudentForUser(admin, tenantId, userId) {
  const { data } = await admin
    .from("students")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

// toIsoDateStart, toIsoDateEnd y statusForSummary vivían aquí y las usa
// /summary, que salió a notebookSummary.routes.js el 09/09/2026 sin
// llevárselas: aquella ruta las llamaba sin tenerlas y devolvía 500. Ahora
// están en lib/notebook/resumen.js, importadas por quien las use.

export default async function notebookRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  const methodNotAllowed = async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
  };

  app.get("/", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const parsed = NotebookQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_query", "Invalid query", requestId, {
        issues: parsed.error.issues,
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
    let studentId = parsed.data.studentId;
    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return ok(reply, { items: [], limit: parsed.data.limit, offset: parsed.data.offset }, requestId);
      }
      studentId = student.id;
    } else {
      // Profesor o admin: el studentId llega del query. Comprobarlo aquí y
      // no solo el tenant (09/09/2026) — las notas de un alumno son de su
      // profesor, no de todo el claustro.
      const alumnoOk = await verificarAlumnoVisible(admin, {
        role: auth.membership.role,
        tenantId: auth.tenant.id,
        tenantSlug: auth.tenant.slug,
        userId: auth.user.id,
        email: auth.user.email || "",
        alumnoId: studentId,
      });
      if (!alumnoOk.ok) {
        if (alumnoOk.code === "visibilidad_fetch_failed") {
          req.log.error({ err: alumnoOk.error, requestId }, "notebook GET: fallo resolviendo visibilidad");
          return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
        }
        return ok(reply, { items: [], limit: parsed.data.limit, offset: parsed.data.offset }, requestId);
      }
    }

    const { limit, offset } = parsed.data;
    const { data, error } = await admin
      .from("grades")
      .select("id, student_id, teacher_id, title, score, date, created_at")
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return fail(reply, 500, "notebook_fetch_failed", "Failed to fetch notebook", requestId);
    }

    return ok(reply, { items: data || [], limit, offset }, requestId);
  });

  app.post("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = NotebookCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    // Poner nota a un alumno de otro profesor es escribir en su expediente.
    const alumnoOk = await verificarAlumnoVisible(admin, {
      role: auth.membership.role,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      alumnoId: parsed.data.student_id,
    });
    if (!alumnoOk.ok) {
      if (alumnoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: alumnoOk.error, requestId }, "notebook POST: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      return fail(reply, 403, "forbidden", "Ese alumno no es de tus grupos", requestId);
    }

    const { data, error } = await admin
      .from("grades")
      .insert({
        tenant_id: auth.tenant.id,
        student_id: parsed.data.student_id,
        teacher_id: auth.user.id,
        title: parsed.data.title,
        score: parsed.data.score,
        date: parsed.data.date || null,
      })
      .select("id, student_id, teacher_id, title, score, date, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "notebook_create_failed", "Failed to create entry", requestId);
    }

    return created(reply, data, requestId);
  });

  app.patch("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = NotebookPatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, {
        issues: parsed.error.issues,
      });
    }

    const rl = await rateLimit(req, {
      limit: 60,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    // Hay que leer de quién es la nota ANTES de tocarla: el body solo trae
    // el id de la fila, así que sin esto un profesor editaba la calificación
    // que otro había puesto a un alumno que no es suyo.
    const { data: fila } = await admin
      .from("grades")
      .select("student_id")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!fila) return fail(reply, 404, "not_found", "Entry not found", requestId);

    const alumnoOk = await verificarAlumnoVisible(admin, {
      role: auth.membership.role,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      alumnoId: fila.student_id,
    });
    if (!alumnoOk.ok) {
      if (alumnoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: alumnoOk.error, requestId }, "notebook PATCH: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      return fail(reply, 404, "not_found", "Entry not found", requestId);
    }

    const { data, error } = await admin
      .from("grades")
      .update({
        title: parsed.data.title,
        score: parsed.data.score,
        date: parsed.data.date,
      })
      .eq("tenant_id", auth.tenant.id)
      .eq("id", parsed.data.id)
      .select("id, student_id, teacher_id, title, score, date, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "notebook_update_failed", "Failed to update entry", requestId);
    }

    return ok(reply, data, requestId);
  });

  app.put("/", methodNotAllowed);
  app.delete("/", methodNotAllowed);
  app.head("/", methodNotAllowed);

}
