import { Redis } from "@upstash/redis";
import { getEnv } from "./env.js";

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) {
    throw new Error("Missing Upstash Redis envs");
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function getRoute(req) {
  const url = req?.url || "";
  return url.split("?")[0] || "/";
}

function getIp(req) {
  const xf = String(req.headers?.["x-forwarded-for"] || "");
  const ip = xf.split(",")[0]?.trim();
  if (ip) return ip;
  return (
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    "unknown"
  );
}

export async function rateLimit(req, {
  limit = 60,
  windowSec = 60,
  userId = "",
  tenantId = "",
} = {}) {
  const route = getRoute(req);
  const redis = getRedis();

  const key = userId
    ? `rl:u:${userId}:t:${tenantId || "global"}:r:${route}`
    : `rl:ip:${getIp(req)}:r:${route}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  const remaining = Math.max(0, limit - count);

  return {
    ok: count <= limit,
    limit,
    remaining,
    resetSec: windowSec,
    key,
  };
}
