import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { refreshUserSession } from "../../lib/authRefresh.js";

const RefreshBodySchema = z.object({
  refresh_token: z.string().min(1),
});

// POST /api/v1/auth/refresh — canjea un refresh_token por una sesión nueva.
// Archivo separado de auth.routes.js (ya en 399 líneas, al límite) en vez
// de añadir la ruta ahí — misma responsabilidad (auth), pieza propia.
//
// Usado por apiFetch (assets/shared/js/session/refreshSession.js) cuando
// una petición recibe 401: si el refresh aquí funciona, la sesión no
// estaba realmente caducada (solo el access_token había expirado) y la
// petición original se reintenta transparente; si falla, sí lo está.
export default async function authRefreshRoutes(app) {
  app.post("/refresh", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

    const rl = await rateLimit(req, { limit: 30, windowSec: 60 });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const parsed = RefreshBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const resultado = await refreshUserSession(parsed.data.refresh_token);
    if (!resultado.ok) {
      return fail(reply, 401, "invalid_refresh_token", resultado.motivo, requestId);
    }

    return ok(reply, resultado.session, requestId);
  });
}
