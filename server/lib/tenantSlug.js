function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function subdomainFromHost(req) {
  // x-forwarded-host is set by Vercel/proxies with the original hostname
  const raw =
    first(req.headers?.["x-forwarded-host"]) ||
    first(req.headers?.["host"]) ||
    "";
  const hostname = String(raw).split(":")[0].toLowerCase().trim();
  const parts = hostname.split(".");
  // Only treat as tenant slug if there are 3+ parts (sub.domain.tld)
  // and the subdomain is not a well-known non-tenant name
  if (parts.length < 3) return "";
  const sub = parts[0];
  if (!sub || sub === "www" || sub === "api" || sub === "app") return "";
  return sub;
}

export function getTenantSlug(req) {
  const header =
    first(req.headers?.["x-ttd-tenant"]) ||
    first(req.headers?.["x-tenant-slug"]) ||
    first(req.headers?.["x-tenant"])
    || "";

  const fallback =
    req.tenantSlug ||
    req.tenant?.slug ||
    req?.query?.tenant ||
    req?.query?.tenant_slug ||
    "";

  return String(header || fallback || subdomainFromHost(req)).trim().toLowerCase();
}
