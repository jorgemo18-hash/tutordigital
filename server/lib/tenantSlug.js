export function getTenantSlug(req) {
  const header =
    req.headers?.["x-tenant-slug"] ||
    req.headers?.["x-tenant"] ||
    "";
  const query = req?.query?.tenant || "";
  return String(header || query || "").trim().toLowerCase();
}
