import { makeRequestId } from "../../lib/requestId.js";
import { getEnv } from "../../lib/env.js";
import { askAnthropicChat, validateChatBody } from "../../lib/chat.js";
import { makeChatSecurity } from "../../lib/security/chatGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

export default async function chatRoutes(app) {
  const chatSecurity = makeChatSecurity({ env: process.env });
  const tenantMembershipGuard = makeTenantMembershipGuard();
  const bodyLimit = Number(getEnv("CHAT_BODY_LIMIT_BYTES", "250000"));
  const handlerTimeoutMs = Number(getEnv("CHAT_HANDLER_TIMEOUT_MS", "30000"));

  const withTimeout = async (promise, timeoutMs) => {
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`chat_timeout_${timeoutMs}`);
            error.code = "chat_timeout";
            reject(error);
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

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

  app.post("/", { bodyLimit, preHandler: [chatSecurity.preHandler, tenantMembershipGuard.preHandler] }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

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

    let run;
    try {
      run = await withTimeout(
        askAnthropicChat(validation.data, {
          apiKey: getEnv("ANTHROPIC_API_KEY", ""),
          defaultModel: getEnv("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        }),
        handlerTimeoutMs
      );
    } catch (error) {
      if (error?.code === "chat_timeout") {
        return failChat(reply, 504, "chat_timeout", "Chat timeout", requestId);
      }
      return failChat(reply, 500, "chat_failed", "Chat failed", requestId);
    }

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
