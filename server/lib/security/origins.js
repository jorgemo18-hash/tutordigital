export const DEFAULT_ALLOWED_ORIGINS =
  "https://tutordigital.vercel.app,https://tutordigital-*.vercel.app,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000";

export function parseAllowedOrigins(raw = "") {
  return String(raw)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeOrigin(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\/+$/, "");
}

function wildcardToRegex(pattern = "") {
  const escaped = String(pattern)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesAllowedOrigin(origin, allowedOrigins = []) {
  const target = normalizeOrigin(origin);
  if (!target) return false;

  return allowedOrigins.some((raw) => {
    const rule = normalizeOrigin(raw);
    if (!rule) return false;
    if (rule === target) return true;
    if (rule.includes("*")) return wildcardToRegex(rule).test(target);
    return false;
  });
}

export function originFromReferer(referer = "") {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return "";
  }
}

export function getEffectiveOrigin({ origin = "", referer = "" } = {}) {
  return origin || originFromReferer(referer) || "";
}

export function getAllowedOrigins({
  env = process.env,
  envNames = ["ALLOWED_ORIGINS", "CHAT_ALLOWED_ORIGINS"],
} = {}) {
  for (const name of envNames) {
    const raw = env?.[name];
    if (raw) return parseAllowedOrigins(raw);
  }
  return parseAllowedOrigins(DEFAULT_ALLOWED_ORIGINS);
}
