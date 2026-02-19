import { getAccessToken, getTenantSlug } from "./auth.js";

const DEBUG_STUDENT_BOOT =
  Boolean(window.RUNTIME_CONFIG?.DEBUG_STUDENT_BOOT) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("ttd_debug_student_boot") === "1");

function dwarn(...args) { if (DEBUG_STUDENT_BOOT) console.warn(...args); }

export function requireSessionOrRedirect({ requireTenant = true } = {}) {
  const token = getAccessToken();
  if (!token) {
    try {
      dwarn("[STUDENT_GUARD] redirect reason", {
        reason: "missing_token",
        path: window.location.pathname,
        search: window.location.search,
        requireTenant,
        tenant: getTenantSlug(),
      });
    } catch {}
    window.location.href = "/index.html";
    return { token: "", tenantSlug: "" };
  }
  const tenantSlug = getTenantSlug();
  if (requireTenant && !tenantSlug) {
    try {
      dwarn("[STUDENT_GUARD] redirect reason", {
        reason: "missing_tenant",
        path: window.location.pathname,
        search: window.location.search,
        requireTenant,
        tenant: tenantSlug,
      });
    } catch {}
    window.location.href = "/index.html";
    return { token, tenantSlug: "" };
  }
  return { token, tenantSlug };
}
