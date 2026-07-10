const memoryStore = new Map();

function getRoute(req) {
  const url = req?.url || "";
  return url.split("?")[0] || "/";
}

// req.ip: con trustProxy activado en Fastify (ver app.js), ya resuelve la IP
// real del cliente a partir de X-Forwarded-For de forma segura — antes esta
// función leía el header a mano sin trustProxy, así que un cliente podía
// enviar su propio X-Forwarded-For y rotarlo para saltarse el rate limit.
function getIp(req) {
  return req?.ip || req?.socket?.remoteAddress || req?.connection?.remoteAddress || "unknown";
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export async function rateLimit(req, {
  limit = 60,
  windowSec = 60,
  userId = "",
  tenantId = "",
} = {}) {
  if (req?.method === "OPTIONS") {
    return {
      ok: true,
      limit,
      remaining: limit,
      resetSec: windowSec,
      key: "rl:options",
    };
  }
  const route = getRoute(req);
  const key = userId
    ? `rl:u:${userId}:t:${tenantId || "global"}:r:${route}`
    : `rl:ip:${getIp(req)}:r:${route}`;

  const current = nowSec();
  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= current) {
    const resetAt = current + windowSec;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetSec: windowSec,
      key,
    };
  }

  entry.count += 1;
  memoryStore.set(key, entry);
  const remaining = Math.max(0, limit - entry.count);

  return {
    ok: entry.count <= limit,
    limit,
    remaining,
    resetSec: Math.max(0, entry.resetAt - current),
    key,
  };
}
