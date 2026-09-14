import { escapeHtml } from "./printDocumento.js";
import { formatFechaEs } from "../../../../utils/formatFecha.js";
import { formatoEuros, numeroEs } from "../../../../../../../shared/js/formatoDinero.js";

function buildTablaSimple(titulo, filas) {
  const rows = filas
    .map(([label, valor]) => `<tr><td>${escapeHtml(label)}</td><td class="ac-print-valor">${escapeHtml(valor)}</td></tr>`)
    .join("");
  return `<h2 class="ac-print-anexo-titulo">${escapeHtml(titulo)}</h2><table class="ac-print-tabla ac-print-tabla-anexo"><tbody>${rows}</tbody></table>`;
}

// Modelo 130 — gastos reales del trimestre (academia_gastos), no derivados
// de ninguna casilla, por eso necesita su propia tabla con columnas
// distintas en vez de la tabla label/valor genérica de los otros anexos.
export function buildAnexoGastosHtml(gastos) {
  if (!gastos.length) {
    return `<h2 class="ac-print-anexo-titulo">Gastos deducibles del trimestre</h2><p class="ac-print-vacio">Sin gastos registrados.</p>`;
  }
  const rows = gastos
    .map(
      (g) => `<tr>
        <td>${escapeHtml(formatFechaEs(g.fecha))}</td>
        <td>${escapeHtml(g.proveedor || "—")}</td>
        <td>${escapeHtml(g.categoria || "—")}</td>
        <td class="ac-print-valor">${numeroEs(g.base_imponible)} €</td>
        <td class="ac-print-valor">${numeroEs(g.iva_importe)} €</td>
        <td class="ac-print-valor">${numeroEs(g.importe)} €</td>
      </tr>`
    )
    .join("");
  return `
    <h2 class="ac-print-anexo-titulo">Gastos deducibles del trimestre</h2>
    <table class="ac-print-tabla ac-print-tabla-anexo">
      <thead><tr><th>Fecha</th><th>Proveedor</th><th>Categoría</th><th>Base imponible</th><th>IVA</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildAnexoAlquilerHtml({ base, iva, retencion, total, baseTrim, retencionTrim }) {
  const euros = (v) => formatoEuros(v);
  return buildTablaSimple("Desglose alquiler", [
    ["Base mensual", euros(base)],
    ["IVA 21%", euros(iva)],
    ["Retención", euros(retencion)],
    ["Total a pagar propietario", euros(total)],
    ["Base trimestral (× 3)", euros(baseTrim)],
    ["Retención trimestral (× 3)", euros(retencionTrim)],
  ]);
}

export function buildAnexoNominasHtml({ baseTrimestral, retencionPct, retencionTrimestral }) {
  return buildTablaSimple("Resumen nóminas", [
    ["Base trimestral", formatoEuros(baseTrimestral)],
    ["% retención", `${Number(retencionPct || 0)}%`],
    ["Retención trimestral", formatoEuros(retencionTrimestral)],
  ]);
}
