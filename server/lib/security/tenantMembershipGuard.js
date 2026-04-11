import { makeRequestId } from "../requestId.js";
import { requireAuth } from "../auth.js";
import { resolveTenantForUser } from "../tenant.js";
import { getTenantSlug } from "../tenantSlug.js";

export function makeTenantMembershipGuard({
  requireAuthFn = requireAuth,
  resolveTenantForUserFn = resolveTenantForUser,
  getTenantSlugFn = getTenantSlug,
} = {}) {
  return {
    preHandler: async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      req.requestId = requestId;
      reply.header("x-request-id", requestId);

      const tenantSlug = String(getTenantSlugFn(req) || "").trim().toLowerCase();
      if (!tenantSlug) {
        // No inventar defaults: dejamos que la ruta mantenga su comportamiento actual.
        return undefined;
      }

      const auth = await requireAuthFn(req);
      if (!auth?.ok || !auth?.user?.id) {
        // La ruta decidirá si responder 401/403.
        return undefined;
      }

      const resolved = await resolveTenantForUserFn({
        userId: auth.user.id,
        tenantSlug,
        allowedRoles: [],
      });

      req.log.info({
        requestId,
        userId: auth.user.id,
        tenantSlug,
        resolvedOk: resolved?.ok,
        resolvedError: resolved?.error,
      }, "tenantMembershipGuard");

      if (!resolved?.ok) {
        reply.code(403);
        return reply.send({
          ok: false,
          error: { code: "forbidden_tenant", message: "Tenant forbidden" },
          requestId,
        });
      }

      req.tenantSlug = tenantSlug;
      req.userId = auth.user.id;
      return undefined;
    },
  };
}
