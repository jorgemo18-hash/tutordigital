// mobileSuperShared.js — Tipos/estados reales de tenant (no los del mock de
// referencia) y sus badges HTML, compartidos entre Inicio y el drill-in de
// detalle. Mismos valores que assets/superadmin/superadmin.js (TYPE_MAP /
// ESTADO_MAP) para no divergir del escritorio.
import { escHtml as _esc } from "../../shared/js/escHtml.js";

export const TYPE_LABEL = {
  academia:   "Academia",
  integrado:  "Centro integrado",
  standalone: "Centro stand-alone",
};

export const STATUS_LABEL = {
  active:   "Activo",
  trial:    "Prueba",
  inactive: "Pausado",
  pending:  "Pendiente",
};

export const STATUS_CLS = {
  active:   "activo",
  trial:    "prueba",
  inactive: "pausado",
  pending:  "pendiente",
};

export function tipoBadgeHtml(type) {
  if (!TYPE_LABEL[type]) return `<span class="tipo-badge">${_esc(type || "—")}</span>`;
  return `<span class="tipo-badge ${type}">${_esc(TYPE_LABEL[type])}</span>`;
}

export function estadoBadgeHtml(status) {
  const cls   = STATUS_CLS[status] || "pausado";
  const label = STATUS_LABEL[status] || status || "—";
  return `<span class="estado ${cls}"><span class="dot"></span>${_esc(label)}</span>`;
}
