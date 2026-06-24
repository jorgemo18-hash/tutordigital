// Gráfico de barras agrupadas en SVG puro — una serie por categoría
// (ej. ingresos/gastos), una barra por mes. Sin dependencias externas.
export function buildBarChart({ labels, series, height = 180 }) {
  const width = Math.max(1, labels.length) * 56;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const groupWidth = width / labels.length;
  const barWidth = groupWidth / (series.length + 1);
  const plotHeight = height - 22;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(height));
  svg.setAttribute("preserveAspectRatio", "none");

  labels.forEach((label, i) => {
    series.forEach((serie, si) => {
      const val = serie.values[i] || 0;
      const barHeight = (val / maxVal) * plotHeight;
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      rect.setAttribute("x", String(i * groupWidth + (si + 0.5) * barWidth));
      rect.setAttribute("y", String(plotHeight - barHeight));
      rect.setAttribute("width", String(Math.max(2, barWidth - 4)));
      rect.setAttribute("height", String(Math.max(0, barHeight)));
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", serie.color);
      svg.appendChild(rect);
    });

    const text = document.createElementNS(svg.namespaceURI, "text");
    text.setAttribute("x", String(i * groupWidth + groupWidth / 2));
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
