// Construcción del HTML de impresión de un modelo fiscal — cabecera
// (logo+emisor) y tabla de casillas, inyectadas como bloque "solo
// impresión" en la página en vivo cuando el admin pulsa "Descargar PDF".
export function escapeHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function buildHeaderHtml(config) {
  const direccion = [config?.direccion_emisor, [config?.cp_emisor, config?.ciudad_emisor].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const logoHtml = config?.logo_url
    ? `<img src="${escapeHtml(config.logo_url)}" class="ac-print-logo" alt="Logo" />`
    : "";
  return `
    <div class="ac-print-header">
      <div class="ac-print-header-logo">${logoHtml}</div>
      <div class="ac-print-header-emisor">
        <div class="ac-print-emisor-nombre">${escapeHtml(config?.nombre_emisor || "")}</div>
        <div>${escapeHtml(config?.dni_emisor || "")}</div>
        <div>${escapeHtml(direccion)}</div>
        <div>${escapeHtml(config?.telefono_emisor || "")}</div>
        <div>${escapeHtml(config?.email_emisor || "")}</div>
      </div>
    </div>`;
}

// Lee una fila .ac-fiscal-casilla-row ya renderizada en pantalla (botón
// individual, vista en vivo) y extrae lo que se ve ahora mismo — funciona
// igual con casillas editables, calculadas o de solo lectura porque solo
// mira el DOM ya construido, no el tipo de casilla que la generó.
export function extraerFilaImpresion(row) {
  const [numeroEl, labelEl, valorWrap] = row.children;
  const input = valorWrap.querySelector("input");
  const valSpan = valorWrap.querySelector(".ac-fiscal-casilla-valor");
  const unidadEl = valorWrap.querySelector(".ac-fiscal-casilla-unidad");
  const unidad = unidadEl ? unidadEl.textContent : "";
  let valor;
  if (input) {
    const num = Number(input.value) || 0;
    valor = unidad === "%" ? `${num}%` : `${num.toFixed(2)} ${unidad || "€"}`.trim();
  } else {
    valor = valSpan ? valSpan.textContent : "";
  }
  return { numero: numeroEl.textContent, label: labelEl.textContent, valor };
}

export function buildCasillasTableHtml(filas) {
  const rows = filas
    .map(
      (f) => `<tr>
        <td class="ac-print-numero">${escapeHtml(f.numero)}</td>
        <td>${escapeHtml(f.label)}</td>
        <td class="ac-print-valor">${escapeHtml(f.valor)}</td>
      </tr>`
    )
    .join("");
  return `<table class="ac-print-tabla ac-print-tabla-casillas"><tbody>${rows}</tbody></table>`;
}

// Cabecera + separador + título + tabla de casillas — el botón
// individual (vista en vivo) solo necesita esto, porque la barra "A
// ingresar" ya existe en la página (se reutiliza tal cual, restyleada
// por _fiscal-print.css) y el anexo se inserta aparte, después de ella.
export function buildCabeceraConCasillasHtml({ config, titulo, filas }) {
  return `
    ${buildHeaderHtml(config)}
    <hr class="ac-print-sep" />
    <h1 class="ac-print-titulo">${escapeHtml(titulo)}</h1>
    ${buildCasillasTableHtml(filas)}`;
}
