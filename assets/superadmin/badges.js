// Helpers de visualización compartidos por las vistas Inicio/Centros del
// escritorio — tenants.type acepta solo estos 3 valores (CHECK constraint
// en BD), mismos labels que mobileSuperShared.js (TYPE_LABEL) y
// views/centro-detalle/constants.js, para no divergir entre vistas.
export function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const TYPE_MAP = {
  academia:   { label: "Academia",            badge: "academia",   color: "#d6a64a" },
  integrado:  { label: "Centro integrado",    badge: "integrado",  color: "#8fb2c9" },
  standalone: { label: "Centro stand-alone",  badge: "standalone", color: "#9fc096" },
};

export const ESTADO_MAP = {
  active:   { cls: "activo",   label: "Activo"    },
  trial:    { cls: "prueba",   label: "Prueba"    },
  inactive: { cls: "pausado",  label: "Pausado"   },
  pending:  { cls: "pendiente",label: "Pendiente" },
};

export function typeBadge(type) {
  const m = TYPE_MAP[type];
  if (!m) return `<span class="sa-badge">${escHtml(type || "—")}</span>`;
  return `<span class="sa-badge ${m.badge}">${m.label}</span>`;
}

export function estadoBadge(status) {
  const m = ESTADO_MAP[status] || { cls: "pausado", label: status || "—" };
  return `<span class="sa-estado ${m.cls}"><span class="dot"></span>${m.label}</span>`;
}

export function centroIni(name) {
  return escHtml((name || "?")[0].toUpperCase());
}
