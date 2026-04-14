import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireAuth } from "../../lib/auth.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { getBuildInfo } from "../../lib/version.js";
import { sendSupportEmail } from "../../lib/email.js";

const ContactSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
});

export default async function supportRoutes(app) {
  const security = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_STUDENTS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_STUDENTS_RATE_MAX",
    routeName: "support-contact",
  });

  // POST /api/v1/support/contact — cualquier usuario autenticado
  app.post(
    "/support/contact",
    { preHandler: [security.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireAuth(req);
      if (!auth.ok) return fail(reply, 401, "unauthorized", "Unauthorized", requestId);

      const parsed = ContactSchema.safeParse(req.body || {});
      if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

      // Rate limit más estricto para evitar spam (10 mensajes / 5 minutos)
      const rl = await rateLimit(req, { limit: 10, windowSec: 300, userId: auth.user.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const { subject, message } = parsed.data;
      const fromEmail = String(auth.user.email || "desconocido").trim();

      try {
        await sendSupportEmail({ fromEmail, subject, message });
      } catch (err) {
        req.log.error({ err, requestId }, "support email send failed");
        return fail(reply, 500, "email_failed", "No se pudo enviar el mensaje de soporte", requestId);
      }

      return ok(reply, { sent: true }, requestId);
    }
  );
}
