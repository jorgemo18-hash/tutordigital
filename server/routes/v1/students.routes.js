import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import {
  resolverGrupoIdsVisibles, verificarAlumnoVisible, verificarGrupoVisible,
} from "../../lib/instituto/alumnosVisibles.js";
import {
  StudentsQuerySchema,
  StudentCreateSchema,
  StudentPatchSchema,
} from "../../lib/validators.js";

async function getStudentForUser(admin, tenantId, userId) {
  const { data } = await admin
    .from("students")
    .select("id, group_id, display_name, approval_status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export default async function studentsRoutes(app) {
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

    const parsed = StudentsQuerySchema.safeParse(req.query || {});
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
    const { limit, offset, groupId, group_id, approval_status } = parsed.data;
    const finalGroupId = group_id || groupId || null;

    if (auth.membership.role === "student") {
      const student = await getStudentForUser(admin, auth.tenant.id, auth.user.id);
      if (!student) {
        return ok(reply, { items: [], limit, offset }, requestId);
      }
      if (finalGroupId && finalGroupId !== student.group_id) {
        return ok(reply, { items: [], limit, offset }, requestId);
      }
      return ok(reply, { items: [student], limit: 1, offset: 0 }, requestId);
    }

    // Un profesor ve la lista de SUS grupos, no la del instituto entero
    // (09/09/2026). El admin sigue viéndola completa.
    const { grupoIds, error: visErr } = await resolverGrupoIdsVisibles(admin, {
      role: auth.membership.role,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
    });
    if (visErr) {
      req.log.error({ err: visErr, requestId }, "students GET: fallo resolviendo visibilidad");
      return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
    }
    if (Array.isArray(grupoIds) && !grupoIds.length) {
      return ok(reply, { items: [], limit, offset }, requestId);
    }
    // Pedir un grupo que no es suyo devuelve vacío, no la lista entera: sin
    // esto, el filtro de abajo se aplicaría sobre todo el centro.
    if (Array.isArray(grupoIds) && finalGroupId && !grupoIds.includes(finalGroupId)) {
      return ok(reply, { items: [], limit, offset }, requestId);
    }

    let query = admin
      .from("students")
      .select("id, display_name, group_id, status, approval_status, rejected_reason, rejected_at, user_id, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("display_name", { ascending: true });

    if (Array.isArray(grupoIds)) query = query.in("group_id", grupoIds);
    if (finalGroupId) query = query.eq("group_id", finalGroupId);
    if (approval_status) query = query.eq("approval_status", approval_status);
    if (approval_status === "approved" && parsed.data.status) {
      query = query.eq("status", parsed.data.status);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return fail(reply, 500, "students_fetch_failed", "Failed to fetch students", requestId);
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

    const parsed = StudentCreateSchema.safeParse(req.body || {});
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

    if (parsed.data.group_id) {
      const { data: group } = await admin
        .from("groups")
        .select("id")
        .eq("tenant_id", auth.tenant.id)
        .eq("id", parsed.data.group_id)
        .maybeSingle();
      if (!group) return fail(reply, 404, "group_not_found", "Group not found", requestId);

      // Y que el grupo de destino sea suyo: si no, un profesor podría mover
      // alumnos a grupos ajenos o dar de alta en ellos.
      const grupoOk = await verificarGrupoVisible(admin, {
        role: auth.membership.role,
        tenantSlug: auth.tenant.slug,
        userId: auth.user.id,
        email: auth.user.email || "",
        grupoId: parsed.data.group_id,
      });
      if (!grupoOk.ok) {
        if (grupoOk.code === "visibilidad_fetch_failed") {
          req.log.error({ err: grupoOk.error, requestId }, "students: fallo resolviendo visibilidad");
          return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
        }
        return fail(reply, 404, "group_not_found", "Group not found", requestId);
      }
    }

    const { data, error } = await admin
      .from("students")
      .insert({
        tenant_id: auth.tenant.id,
        display_name: parsed.data.display_name,
        group_id: parsed.data.group_id || null,
        status: parsed.data.status || "pending",
        user_id: parsed.data.user_id || null,
        approval_status: parsed.data.approval_status || "approved",
      })
      .select("id, display_name, group_id, status, approval_status, rejected_reason, rejected_at, user_id, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "student_create_failed", "Failed to create student", requestId);
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

    const parsed = StudentPatchSchema.safeParse(req.body || {});
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

    if (parsed.data.group_id) {
      const { data: group } = await admin
        .from("groups")
        .select("id")
        .eq("tenant_id", auth.tenant.id)
        .eq("id", parsed.data.group_id)
        .maybeSingle();
      if (!group) return fail(reply, 404, "group_not_found", "Group not found", requestId);

      // Y que el grupo de destino sea suyo: si no, un profesor podría mover
      // alumnos a grupos ajenos o dar de alta en ellos.
      const grupoOk = await verificarGrupoVisible(admin, {
        role: auth.membership.role,
        tenantSlug: auth.tenant.slug,
        userId: auth.user.id,
        email: auth.user.email || "",
        grupoId: parsed.data.group_id,
      });
      if (!grupoOk.ok) {
        if (grupoOk.code === "visibilidad_fetch_failed") {
          req.log.error({ err: grupoOk.error, requestId }, "students: fallo resolviendo visibilidad");
          return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
        }
        return fail(reply, 404, "group_not_found", "Group not found", requestId);
      }
    }

    // El alumno que se está tocando también tiene que ser suyo: comprobar
    // solo el grupo de DESTINO dejaría sacar a un alumno ajeno de su grupo
    // para meterlo en uno propio.
    const alumnoOk = await verificarAlumnoVisible(admin, {
      role: auth.membership.role,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      alumnoId: parsed.data.id,
    });
    if (!alumnoOk.ok) {
      if (alumnoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: alumnoOk.error, requestId }, "students PATCH: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      return fail(reply, 404, "not_found", "Student not found", requestId);
    }

    const updates = {
      display_name: parsed.data.display_name,
      group_id: parsed.data.group_id,
      status: parsed.data.status,
      user_id: parsed.data.user_id,
      approval_status: parsed.data.approval_status,
      rejected_reason: parsed.data.rejected_reason,
    };
    if (parsed.data.approval_status === "approved") {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = auth.user.id;
      updates.rejected_at = null;
      updates.rejected_by = null;
    }
    if (parsed.data.approval_status === "rejected") {
      updates.rejected_at = new Date().toISOString();
      updates.rejected_by = auth.user.id;
    }
    const { data, error } = await admin
      .from("students")
      .update(updates)
      .eq("id", parsed.data.id)
      .eq("tenant_id", auth.tenant.id)
      .select("id, display_name, group_id, status, approval_status, user_id, created_at")
      .single();

    if (error) {
      return fail(reply, 500, "student_update_failed", "Failed to update student", requestId);
    }

    return ok(reply, data, requestId);
  });

  app.delete("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const id = req?.body?.id || req?.query?.id;
    if (!id) {
      return fail(reply, 400, "invalid_body", "Missing id", requestId);
    }

    const rl = await rateLimit(req, {
      limit: 30,
      windowSec: 60,
      userId: auth.user.id,
      tenantId: auth.tenant.id,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const admin = createSupabaseAdmin();
    // Borrar un alumno se lleva por delante su expediente. Solo el de sus
    // grupos — y ver más abajo la nota sobre si esto debería poder hacerlo
    // un profesor siquiera.
    const alumnoOk = await verificarAlumnoVisible(admin, {
      role: auth.membership.role,
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
      alumnoId: id,
    });
    if (!alumnoOk.ok) {
      if (alumnoOk.code === "visibilidad_fetch_failed") {
        req.log.error({ err: alumnoOk.error, requestId }, "students DELETE: fallo resolviendo visibilidad");
        return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
      }
      return fail(reply, 404, "not_found", "Student not found", requestId);
    }

    const { error } = await admin
      .from("students")
      .delete()
      .eq("tenant_id", auth.tenant.id)
      .eq("id", id);

    if (error) {
      return fail(reply, 500, "student_delete_failed", "Failed to delete student", requestId);
    }

    return ok(reply, { ok: true }, requestId);
  });

  app.put("/", methodNotAllowed);
  app.head("/", methodNotAllowed);
}

// PREGUNTA DE PRODUCTO SIN RESOLVER (09/09/2026): POST, PATCH y DELETE
// aceptan el rol `teacher`. En una academia tiene sentido —el profesor suele
// ser el dueño—, pero en un instituto dar de alta y BORRAR alumnos es de
// secretaría, no del profesor de matemáticas. El aislamiento de arriba acota
// el daño a sus propios grupos, que era la fuga urgente; si esto acaba
// siendo solo de admin, esas tres rutas se quedan sin `teacher` y las
// comprobaciones sobran. No se cambia aquí porque es una decisión de Jorge,
// no un fallo.
