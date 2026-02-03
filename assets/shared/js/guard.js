import { getAccessToken, getTenantSlug } from "./auth.js";

export function requireSessionOrRedirect({ requireTenant = true } = {}) {
  const token = getAccessToken();
  if (!token) {
    window.location.href = "/index.html";
    return { token: "", tenantSlug: "" };
  }
  const tenantSlug = getTenantSlug();
  if (requireTenant && !tenantSlug) {
    window.location.href = "/index.html";
    return { token, tenantSlug: "" };
  }
  return { token, tenantSlug };
}
