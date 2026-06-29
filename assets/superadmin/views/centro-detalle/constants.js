// tenants.type acepta solo estos 3 valores (CHECK constraint en BD) —
// mismos labels que assets/superadmin/superadmin.js (TYPE_MAP) y
// mobileSuperShared.js (TYPE_LABEL), para no divergir entre vistas.
export const STATUS_LABELS = { active: "Activo", trial: "Prueba", inactive: "Pausado" };
export const STATUS_CLS = { active: "activo", trial: "prueba", inactive: "pausado" };
export const TYPE_LABELS = {
  academia: "Academia",
  integrado: "Centro integrado",
  standalone: "Centro stand-alone",
};
export const TYPE_OPTS = ["academia", "integrado", "standalone"];

// tenants.regimen_fiscal (solo type='academia') y tenants.sector (solo
// type='standalone'/'integrado') — mismos values que el selector
// condicional de assets/superadmin/views/nuevoCentroForm.js.
export const REGIMEN_FISCAL_LABELS = { autonomo: "Autónomo", sociedad: "Sociedad (SL/SA)" };
export const SECTOR_LABELS = { publico: "Público", privado: "Privado", concertado: "Concertado" };
