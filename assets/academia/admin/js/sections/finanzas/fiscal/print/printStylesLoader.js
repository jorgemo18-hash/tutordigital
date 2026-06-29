// _fiscal-print.css no se importa globalmente desde _academia-admin.css
// — solo hace falta mientras la pestaña Fiscal está montada, así que se
// inyecta aquí dinámicamente. Idempotente: si ya está cargado, no lo
// duplica.
const LINK_ID = "ac-fiscal-print-styles";
const HREF = "/assets/academia/admin/css/_fiscal-print.css";

export function ensurePrintStylesLoaded(doc = document) {
  if (doc.getElementById(LINK_ID)) return;
  const link = doc.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = HREF;
  doc.head.appendChild(link);
}
