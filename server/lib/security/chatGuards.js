import crypto from "node:crypto";

function parseAllowedOrigins(raw = "") {
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeOrigin(value = "") {
  return String(value || "").trim().toLowerCase();
}

function matchesAllowedOrigin(origin, allowedOrigins = []) {
  const target = normalizeOrigin(origin);
  if (!target) return false;
  return allowedOrigins.some((raw) => {
    const rule = normalizeOrigin(raw);
    if (!rule) return false;
    if (rule === target) return true;
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1); // ".vercel.app"
      return target.endsWith(suffix);
    }
    return false;
  });
}

function getHeader(req, name) {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function originFromReferer(referer = "") {
  try {
    const u = new URL(referer);
    return u.origin;
  } catch {
    return "";
  }
}

export function makeChatSecurity({ env }) {
  const allowedOrigins = parseAllowedOrigins(
    env.CHAT_ALLOWED_ORIGINS ||
      "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
  );

  const windowMs = Number(env.CHAT_RATE_WINDOW_MS || 60_000);
  const maxHits = Number(env.CHAT_RATE_MAX || 40);
  const bucket = new Map();

  function cleanup(now) {
    if (bucket.size < 5000) return;
    for (const [key, value] of bucket.entries()) {
      if (value.resetAt <= now) bucket.delete(key);
    }
  }

  function getClientIp(req) {
    return req.ip || getHeader(req, "x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  }

  function getTenant(req) {
    return (
      req.tenant?.slug ||
      req.tenantSlug ||
      getHeader(req, "x-ttd-tenant") ||
      getHeader(req, "x-tenant-slug") ||
      getHeader(req, "x-tenant") ||
      ""
    );
  }

  function fingerprint(req) {
    const raw = `${getClientIp(req)}::${getTenant(req)}`;
    return crypto.createHash("sha1").update(raw).digest("hex");
  }

  function isAllowedOrigin(req) {
    const origin = getHeader(req, "origin") || "";
    const referer = getHeader(req, "referer") || "";
    const effective = origin || originFromReferer(referer);
    if (!effective) return true;
    return matchesAllowedOrigin(effective, allowedOrigins);
  }

  function rateLimit(req) {
    const now = Date.now();
    cleanup(now);

    const key = fingerprint(req);
    const current = bucket.get(key);

    if (!current || current.resetAt <= now) {
      bucket.set(key, { resetAt: now + windowMs, hits: 1 });
      return { ok: true, remaining: maxHits - 1, resetAt: now + windowMs };
    }

    if (current.hits >= maxHits) {
      return { ok: false, remaining: 0, resetAt: current.resetAt };
    }

    current.hits += 1;
    return { ok: true, remaining: maxHits - current.hits, resetAt: current.resetAt };
  }

  return {
    preHandler: async (req, reply) => {
      const requestId = req.requestId || "";
      if (requestId) reply.header("x-request-id", requestId);

      if (!isAllowedOrigin(req)) {
        reply.code(403);
        return reply.send({
          ok: false,
          error: { code: "forbidden_origin", message: "Origin/Referer no permitido" },
          requestId,
        });
      }

      const rl = rateLimit(req);
      reply.header("X-RateLimit-Limit", String(maxHits));
      reply.header("X-RateLimit-Remaining", String(Math.max(0, rl.remaining)));
      reply.header("X-RateLimit-Reset", String(Math.floor(rl.resetAt / 1000)));

      if (!rl.ok) {
        reply.code(429);
        return reply.send({
          ok: false,
          error: { code: "rate_limited", message: "Demasiadas peticiones. Espera un poco." },
          requestId,
        });
      }
      return undefined;
    },
  };
}
