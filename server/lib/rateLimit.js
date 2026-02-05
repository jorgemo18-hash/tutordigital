const memoryStore = new Map();

function getRoute(req) {
  const url = req?.url || "";
  return url.split("?")[0] || "/";
}

function getIp(req) {
  const xf = String(req.headers?.["x-forwarded-for"] || "");
  const ip = xf.split(",")[0]?.trim();
  if (ip) return ip;
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
