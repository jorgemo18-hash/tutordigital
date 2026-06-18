// mobileAdminIcons.js — Inline SVG icons for the mobile admin panel.
// Path data ported 1:1 from the confirmed reference design
// (tutordiseño/gestor/icons.jsx) so the iconography matches exactly.

const PATHS = {
  group:   ["M9 11a3 3 0 100-6 3 3 0 000 6z", "M2 20a7 7 0 0114 0", "M16 5a3 3 0 110 6", "M22 20a6 6 0 00-5-5.9"],
  board:   ["M3 4h18v12H3z", "M8 20h8", "M12 16v4", "M7 9h6", "M7 12h4"],
  cap:     ["M2 8l10-4 10 4-10 4L2 8z", "M6 10.2V14c0 1.2 2.7 2.4 6 2.4s6-1.2 6-2.4v-3.8", "M22 8v5"],
  grid:    ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  enter:   "M5 12h14M13 5l7 7-7 7",
  exit:    "M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4 M10 17l-5-5 5-5 M5 12h10",
  plus:    "M12 5v14M5 12h14",
  close:   "M18 6L6 18 M6 6l12 12",
  check:   "M5 12l5 5L20 7",
  send:    "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  arrowL:  "M19 12H5M12 19l-7-7 7-7",
  chevD:   "M6 9l6 6 6-6",
  copy:    "M9 9h11a2 2 0 012 2v9a2 2 0 01-2 2h-9a2 2 0 01-2-2V11a2 2 0 012-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  refresh: "M3 12a9 9 0 0114.5-7.1L21 7 M21 3v4h-4 M21 12a9 9 0 01-14.5 7.1L3 17 M3 21v-4h4",
  trash:   "M4 7h16 M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2 M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13",
};

export function icon(name, { size = 18, sw = 1.7 } = {}) {
  const d = PATHS[name];
  if (!d) return "";
  const paths = (Array.isArray(d) ? d : [d]).map(p => `<path d="${p}"/>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
