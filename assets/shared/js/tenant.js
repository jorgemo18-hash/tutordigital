export const TENANT_PASSWORDS = {
  lyceo: "lyceo",
  instituto2: "lyceo2",
};

export const TENANT_LABELS = {
  lyceo: "Lyceo (demo)",
  instituto2: "Instituto 2 (demo)",
};

export function normalizeTenantId(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  const map = {
    lyceo: "lyceo",
    instituto1: "lyceo",
    inst1: "lyceo",
    inst2: "instituto2",
    instituto2: "instituto2",
  };
  return map[value] || value;
}

export function getTenantIdFromUrlOrStorage() {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlTenant = params.get("tenant");
    const storedTenant = localStorage.getItem("ttd_activeTenant") || "";
    return normalizeTenantId(urlTenant || storedTenant || "");
  } catch {
    return "";
  }
}

export function ensureTenantInUrl(pathname = "") {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlTenant = params.get("tenant");
    if (urlTenant) return false;
    const tenantId = getTenantIdFromUrlOrStorage();
    if (!tenantId) return false;
    const targetPath = pathname || window.location.pathname || "/";
    window.location.replace(`${targetPath}?tenant=${encodeURIComponent(tenantId)}`);
    return true;
  } catch {
    return false;
  }
}

export function getTenantAccessKey(tenantId) {
  return `ttd_tenantAccess_${tenantId}`;
}

export function hasTenantAccess(tenantId) {
  if (!tenantId) return false;
  return localStorage.getItem(getTenantAccessKey(tenantId)) === "ok";
}

export function setTenantAccess(tenantId) {
  if (!tenantId) return;
  localStorage.setItem(getTenantAccessKey(tenantId), "ok");
}

export function getTenantCfgKey(tenantId) {
  return `ttd_tenantCfg_${tenantId}`;
}

export function loadTenantCfg(tenantId, fallbackCfg = null) {
  if (!tenantId) return null;
  const key = getTenantCfgKey(tenantId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  const cfg = fallbackCfg || {
    name: TENANT_LABELS[tenantId] || tenantId,
    subtitle: "Zona docente",
    bgImage: "/assets/bg/instituto.jpg",
  };
  try { localStorage.setItem(key, JSON.stringify(cfg)); } catch {}
  return cfg;
}

export function saveTenantCfg(tenantId, cfg) {
  if (!tenantId) return;
  try { localStorage.setItem(getTenantCfgKey(tenantId), JSON.stringify(cfg || {})); } catch {}
}
