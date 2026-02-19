function first(value) {
  return Array.isArray(value) ? value[0] : value;
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

  return String(header || fallback || "").trim().toLowerCase();
}
