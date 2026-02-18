import { makeRequestId } from "../../lib/requestId.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { getEnv } from "../../lib/env.js";
import { askOpenAIChat, validateChatBody } from "../../lib/chat.js";

export default async function chatRoutes(app) {
  const failChat = (reply, status, code, message, requestId, details) => {
    reply.header("x-request-id", requestId);
    return reply.code(status).send({
      ok: false,
      error: details ? { code, message, details } : { code, message },
      requestId,
    });
  };

  const methodNotAllowed = async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    return failChat(reply, 405, "method_not_allowed", "Method not allowed", requestId);
  };

  app.post("/", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

    const rl = await rateLimit(req, {
      limit: 30,
      windowSec: 60,
    });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) {
      return failChat(reply, 429, "rate_limited", "Too many requests", requestId);
    }

    const validation = validateChatBody(req.body || {});
    if (!validation.ok) {
      return failChat(
        reply,
        validation.status,
        validation.code,
        validation.message,
        requestId,
        validation.issues ? { issues: validation.issues } : undefined
      );
    }

    const run = await askOpenAIChat(validation.data, {
      apiKey: getEnv("OPENAI_API_KEY", ""),
      defaultModel: getEnv("OPENAI_MODEL", "gpt-4o-mini"),
    });

    if (!run.ok) {
      return failChat(
        reply,
        run.status || 500,
        run.code || "chat_failed",
        run.message || "Chat failed",
        requestId,
        run.meta || undefined
      );
    }

    reply.header("x-request-id", requestId);
    return reply.code(200).send({
      ok: true,
      data: run.data,
      requestId,
    });
  });

  app.get("/", methodNotAllowed);
  app.put("/", methodNotAllowed);
  app.patch("/", methodNotAllowed);
  app.delete("/", methodNotAllowed);
  app.head("/", methodNotAllowed);
}
