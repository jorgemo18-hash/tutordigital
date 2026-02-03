export function groupKey(tenantSlug = "") {
  return `ttd_activeGroupId_${tenantSlug || ""}`;
}

export function getActiveGroupId(tenantSlug = "") {
  if (!tenantSlug) return "";
  try {
    return localStorage.getItem(groupKey(tenantSlug)) || "";
  } catch {
    return "";
  }
}

export function setActiveGroupId(tenantSlug = "", groupId = "") {
  if (!tenantSlug || !groupId) return;
  try {
    localStorage.setItem(groupKey(tenantSlug), String(groupId));
  } catch {}
}

export function clearActiveGroupId(tenantSlug = "") {
  if (!tenantSlug) return;
  try {
    localStorage.removeItem(groupKey(tenantSlug));
  } catch {}
}
