// Construcción del HTML de impresión de un modelo fiscal — cabecera
// (logo+emisor), tabla de casillas y ensamblado final del documento.
// Genera strings de HTML (no nodos DOM) a propósito: el mismo HTML sirve
// tanto para inyectarlo como bloque "solo impresión" en la página en vivo
// (botón individual) como para escribirlo en el document de una ventana
// nueva (botón "Descargar todos"), sin duplicar la plantilla.
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

// Documento completo y autocontenido (cabecera+casillas+banner+anexo) —
// lo usa el botón "Descargar todos": cada modelo se imprime en su propia
// ventana nueva, sin página en vivo de la que reutilizar la barra "A
// ingresar", así que aquí sí hace falta construirla.
export function buildDocumentoHtml({ config, titulo, filas, bannerLabel, bannerTexto, anexoHtml = "" }) {
  return `
    ${buildCabeceraConCasillasHtml({ config, titulo, filas })}
    <div class="ac-fiscal-banner-resultado">
      <span class="ac-fiscal-banner-resultado-label">${escapeHtml(bannerLabel)}</span>
      <span class="ac-fiscal-banner-resultado-valor">${escapeHtml(bannerTexto)}</span>
    </div>
    ${anexoHtml}`;
}
