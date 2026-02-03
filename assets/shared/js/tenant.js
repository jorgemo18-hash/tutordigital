// /assets/shared/js/tenant.js
export const TENANT_LABELS = {
  lyceo: "Lyceo (demo)",
  instituto2: "Instituto 2 (demo)",
};

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

  const cfg =
    fallbackCfg || {
      name: TENANT_LABELS[tenantId] || tenantId,
      subtitle: "Zona docente",
      bgImage: "/assets/bg/instituto.jpg",
    };

  try {
    localStorage.setItem(key, JSON.stringify(cfg));
  } catch {}

  return cfg;
}

export function saveTenantCfg(tenantId, cfg) {
  if (!tenantId) return;
  try {
    localStorage.setItem(getTenantCfgKey(tenantId), JSON.stringify(cfg || {}));
  } catch {}
}
