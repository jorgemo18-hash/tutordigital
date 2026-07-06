// Gráfico de barras agrupadas en SVG puro — una serie por categoría
// (ej. ingresos/gastos), una barra por mes. Sin dependencias externas.
//
// El lienzo (viewBox) usa siempre un ancho de referencia de 12 grupos: con
// `width: 100%` + `preserveAspectRatio="none"`, si el viewBox se estrechara
// proporcionalmente al nº de etiquetas (p.ej. 3 en la vista trimestral), el
// navegador estiraría todo horizontalmente para llenar el mismo contenedor,
// deformando y solapando el texto de las etiquetas. Con el ancho fijo, la
// escala horizontal es siempre la misma y los grupos con menos meses solo
// quedan centrados dentro del lienzo, sin distorsión.
const GRUPOS_REFERENCIA = 12;
const GROUP_WIDTH = 56;

export function buildBarChart({ labels, series, height = 180 }) {
  const contentWidth = Math.max(1, labels.length) * GROUP_WIDTH;
  const width = Math.max(contentWidth, GRUPOS_REFERENCIA * GROUP_WIDTH);
  const offsetX = (width - contentWidth) / 2;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const barWidth = GROUP_WIDTH / (series.length + 1);
  const plotHeight = height - 22;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(height));
  svg.setAttribute("preserveAspectRatio", "none");

  labels.forEach((label, i) => {
    const groupX = offsetX + i * GROUP_WIDTH;

    series.forEach((serie, si) => {
      const val = serie.values[i] || 0;
      const barHeight = (val / maxVal) * plotHeight;
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      rect.setAttribute("x", String(groupX + (si + 0.5) * barWidth));
      rect.setAttribute("y", String(plotHeight - barHeight));
      rect.setAttribute("width", String(Math.max(2, barWidth - 4)));
      rect.setAttribute("height", String(Math.max(0, barHeight)));
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", serie.color);
      svg.appendChild(rect);
    });

    const text = document.createElementNS(svg.namespaceURI, "text");
    text.setAttribute("x", String(groupX + GROUP_WIDTH / 2));
    text.setAttribute("y", String(height - 4));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "9");
    text.setAttribute("fill", "currentColor");
    text.setAttribute("opacity", "0.6");
    text.textContent = label;
    svg.appendChild(text);
  });

  return svg;
}
