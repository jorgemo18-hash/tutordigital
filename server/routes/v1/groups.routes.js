import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { resolverGrupoIdsVisibles } from "../../lib/instituto/alumnosVisibles.js";
import {
  GroupsQuerySchema,
  GroupCreateSchema,
} from "../../lib/validators.js";

function normalizeGroupName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export default async function groupsRoutes(app) {
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

    const parsed = GroupsQuerySchema.safeParse(req.query || {});
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

    const { limit, offset } = parsed.data;
    const admin = createSupabaseAdmin();
    // ERA LA ÚLTIMA RUTA QUE FALLABA ABIERTO (09/09/2026). Usaba
    // getTeacherAssignedGroupIds, que devuelve `null` —y aquí abajo `null`
    // significa "no restringir"— tanto si el profesor no tiene ficha en
    // teacher_profiles COMO SI LA CONSULTA A LA BASE DE DATOS FALLA. Es
    // decir: un hipo de Supabase le enseñaba todos los grupos del centro, y
    // este selector es el que alimenta el cuaderno, las notas y las tareas
    // de todo su panel.
    //
    // resolverGrupoIdsVisibles devuelve siempre una lista para un profesor
    // —vacía si no tiene grupos— y un error explícito si algo falla. Aquel
    // helper ya no lo usa nadie y se ha borrado.
    const { grupoIds: allowedGroupIds, error: visErr } = await resolverGrupoIdsVisibles(admin, {
      role: auth.membership.role,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      email: auth.user.email || "",
    });
    if (visErr) {
      req.log.error({ err: visErr, requestId }, "groups GET: fallo resolviendo visibilidad");
      return fail(reply, 500, "visibilidad_fetch_failed", "No se pudo comprobar el acceso", requestId);
    }
    if (Array.isArray(allowedGroupIds) && !allowedGroupIds.length) {
      return ok(reply, { items: [], limit, offset }, requestId);
    }

    let query = admin
      .from("groups")
      .select("id, tenant_id, name, normalized_name, level, stage, year, track, variant, created_at")
      .eq("tenant_id", auth.tenant.id)
      .order("stage", { ascending: true, nullsFirst: false })
      .order("year", { ascending: true, nullsFirst: false })
      .order("track", { ascending: true, nullsFirst: false })
      .order("variant", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (Array.isArray(allowedGroupIds)) {
      query = query.in("id", allowedGroupIds);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return fail(reply, 500, "groups_fetch_failed", "Failed to fetch groups", requestId);
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

    const parsed = GroupCreateSchema.safeParse(req.body || {});
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
    const { data, error } = await admin
      .from("groups")
      .insert({
        tenant_id: auth.tenant.id,
        name: parsed.data.name,
        level: parsed.data.level || null,
        normalized_name: normalizeGroupName(parsed.data.name),
      })
      .select("id, name, level, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return fail(reply, 409, "duplicate_group", "Group already exists", requestId);
      }
      return fail(reply, 500, "group_create_failed", "Failed to create group", requestId);
    }

    return created(reply, data, requestId);
  });

  app.put("/", methodNotAllowed);
  app.patch("/", methodNotAllowed);
  app.delete("/", methodNotAllowed);
  app.head("/", methodNotAllowed);
}
