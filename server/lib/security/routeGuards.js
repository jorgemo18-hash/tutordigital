function parseAllowedOrigins(raw = "") {
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

function makeRequestIdFallback() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getClientIp(req) {
  return req.ip || getHeader(req, "x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

function getTenantSlug(req) {
  return (
    req.tenant?.slug ||
    req.tenantSlug ||
    getHeader(req, "x-tenant-slug") ||
    getHeader(req, "x-tenant") ||
    req.query?.tenant ||
    ""
  );
}

export function makeRouteSecurity({
  env = process.env,
  allowedOriginsEnv = "CHAT_ALLOWED_ORIGINS",
  rateWindowMsEnv = "CHAT_RATE_WINDOW_MS",
  rateMaxEnv = "CHAT_RATE_MAX",
  keyFn,
  routeName = "route",
} = {}) {
  const allowedOrigins = parseAllowedOrigins(
    env[allowedOriginsEnv] ||
      "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
  );

  const windowMs = Number(env[rateWindowMsEnv] || 60_000);
  const maxHits = Number(env[rateMaxEnv] || 40);
  const bucket = new Map();

  function cleanup(now) {
    if (bucket.size < 5000) return;
    for (const [key, value] of bucket.entries()) {
      if (value.resetAt <= now) bucket.delete(key);
    }
  }

  function defaultKey(req) {
    const ip = getClientIp(req);
    const tenantSlug = getTenantSlug(req) || "no-tenant";
    return `${ip}:${tenantSlug}:${routeName}`;
  }

  function isAllowedOrigin(req) {
    const origin = getHeader(req, "origin") || "";
    const referer = getHeader(req, "referer") || "";
    const effective = origin || originFromReferer(referer);
    if (!effective) return true;
    return allowedOrigins.includes(effective);
  }

  function rateLimit(req) {
    const now = Date.now();
    cleanup(now);

    const bucketKey = typeof keyFn === "function" ? keyFn(req) : defaultKey(req);
    const current = bucket.get(bucketKey);

    if (!current || current.resetAt <= now) {
      bucket.set(bucketKey, { resetAt: now + windowMs, hits: 1 });
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
      const requestId = req.requestId || makeRequestIdFallback();
      req.requestId = requestId;
      reply.header("x-request-id", requestId);

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
