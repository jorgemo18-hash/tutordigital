import { makeRequestId } from "../../lib/requestId.js";
import { getEnv } from "../../lib/env.js";
import { askAnthropicChat, validateChatBody } from "../../lib/chat.js";
import { handleMessage } from "../../lib/orchestrator.js";
import { makeChatSecurity } from "../../lib/security/chatGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getAllowedOrigins, matchesAllowedOrigin } from "../../lib/security/origins.js";

const SSE_HEADERS = {
  "Content-Type":      "text/event-stream",
  "Cache-Control":     "no-cache",
  "Connection":        "keep-alive",
  "X-Accel-Buffering": "no",  // desactiva buffer en nginx/caddy
};

function sseWrite(raw, event) {
  try { raw.write(`data: ${JSON.stringify(event)}\n\n`); } catch {}
}

export default async function chatRoutes(app) {
  const allowedOrigins        = getAllowedOrigins({ env: process.env });
  const chatSecurity          = makeChatSecurity({ env: process.env });
  const tenantMembershipGuard = makeTenantMembershipGuard();
  const bodyLimit             = Number(getEnv("CHAT_BODY_LIMIT_BYTES", "250000"));
  const handlerTimeoutMs      = Number(getEnv("CHAT_HANDLER_TIMEOUT_MS", "30000"));

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

  app.post(
    "/",
    { bodyLimit, preHandler: [chatSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
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

      const apiKey       = getEnv("ANTHROPIC_API_KEY", "");
      const defaultModel = getEnv("ANTHROPIC_MODEL", "claude-sonnet-4-6");
      const { sessionId, stream } = validation.data;

      // ── Modo streaming SSE ──────────────────────────────────────────────
      // Activo cuando el cliente envía { stream: true } y hay sessionId.
      if (stream && sessionId) {
        const reqOrigin  = req.headers.origin || "";
        const corsOrigin = matchesAllowedOrigin(reqOrigin, allowedOrigins) ? reqOrigin : "";
        reply.raw.writeHead(200, {
          ...SSE_HEADERS,
          "x-request-id":                requestId,
          ...(corsOrigin && {
            "Access-Control-Allow-Origin":      corsOrigin,
            "Access-Control-Allow-Credentials": "true",
          }),
        });

        const onChunk = (token) => sseWrite(reply.raw, { type: "token", text: token });

        let run;
        try {
          run = await withTimeout(
            handleMessage({ validatedData: validation.data, apiKey, defaultModel, onChunk }),
            Number(getEnv("CHAT_HANDLER_TIMEOUT_MS", "60000"))  // timeout mayor en streaming
          );
        } catch (err) {
          sseWrite(reply.raw, {
            type:    "error",
            code:    err?.code === "chat_timeout" ? "chat_timeout" : "chat_failed",
            message: err?.code === "chat_timeout" ? "Chat timeout" : "Chat failed",
          });
          reply.raw.end();
          return reply;
        }

        if (!run.ok) {
          // network_error → chat_failed: el cliente lo interpreta como fallo de conexión
          const errCode = run.code === "network_error" ? "chat_failed" : (run.code || "chat_failed");
          sseWrite(reply.raw, { type: "error", code: errCode, message: run.message });
          reply.raw.end();
          return reply;
        }

        // Señales de estado tras los tokens
        if (run.data.stepCompleted) {
          sseWrite(reply.raw, { type: "step_completed", stepMap: run.data.stepMap || null });
        }
        if (run.data.escalate?.should) {
          sseWrite(reply.raw, { type: "escalate", reason: run.data.escalate.reason });
        }
        sseWrite(reply.raw, { type: "done", usage: run.data.usage ?? null });

        reply.raw.end();
        return reply;
      }

      // ── Modo síncrono JSON (sin sesión o sin stream:true) ───────────────
      let run;
      try {
        const fn = sessionId
          ? handleMessage({ validatedData: validation.data, apiKey, defaultModel })
          : askAnthropicChat(validation.data, { apiKey, defaultModel });

        run = await withTimeout(fn, handlerTimeoutMs);
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
          run.code   || "chat_failed",
          run.message || "Chat failed",
          requestId,
          run.meta || undefined
        );
      }

      reply.header("x-request-id", requestId);
      return reply.code(200).send({ ok: true, data: run.data, requestId });
    }
  );

  app.get("/",    methodNotAllowed);
  app.put("/",    methodNotAllowed);
  app.patch("/",  methodNotAllowed);
  app.delete("/", methodNotAllowed);
  app.head("/",   methodNotAllowed);
}
