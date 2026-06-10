const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function _parseScore(raw) {
  const v = parseFloat(String(raw || "").replace(",", "."));
  return Number.isFinite(v) && v >= 0 && v <= 10 ? v : null;
}

function _groupByMonth(cardGrades) {
  const map = new Map(); // "YYYY-MM" → { exam: number[], work: number[] }
  for (const g of cardGrades) {
    if (g._taskType !== "exam" && g._taskType !== "work") continue;
    const score = _parseScore(g.score);
    if (score === null) continue;
    const monthKey = String(g.date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
    if (!map.has(monthKey)) map.set(monthKey, { exam: [], work: [] });
    map.get(monthKey)[g._taskType].push(score);
  }
  return map;
}

function _avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function _buildPts(months, byMonth, type) {
  return months.map((m, i) => {
    const v = _avg((byMonth.get(m) || {})[type] || []);
    return v !== null ? { i, v } : null;
  }).filter(Boolean);
}

function _xPos(i, count, left, w) {
  return count === 1 ? left + w / 2 : left + (i / (count - 1)) * w;
}

function _yPos(v, top, h) {
  // v=10 → top; v=0 → top+h
  return top + h * (1 - v / 10);
}

function _seriesSVG(pts, count, left, w, top, h, lineCls, dotCls, valCls) {
  if (!pts.length) return "";
  const fx = p => _xPos(p.i, count, left, w).toFixed(1);
  const fy = p => _yPos(p.v, top, h).toFixed(1);

  let out = "";
  if (pts.length > 1) {
    const d = pts.map((p, j) => `${j === 0 ? "M" : "L"}${fx(p)},${fy(p)}`).join(" ");
    out += `<path d="${d}" class="${lineCls}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  for (const p of pts) {
    const px = fx(p), py = fy(p);
    const vy = (_yPos(p.v, top, h) - 9).toFixed(1);
    out += `<circle cx="${px}" cy="${py}" r="3.5" class="${dotCls}"/>`;
    out += `<text x="${px}" y="${vy}" text-anchor="middle" class="${valCls}" font-size="9" font-weight="500">${p.v.toFixed(1)}</text>`;
  }
  return out;
}

// Returns HTML string (SVG + legend div), or "" if no gradeable data.
export function buildChartHTML(cardGrades) {
  const byMonth = _groupByMonth(cardGrades);
  if (!byMonth.size) return "";

  const months = [...byMonth.keys()].sort();
  const examPts = _buildPts(months, byMonth, "exam");
  const workPts = _buildPts(months, byMonth, "work");
  if (!examPts.length && !workPts.length) return "";

  const LEFT = 38, RIGHT = 268, TOP = 22, BOT = 108;
  const W = RIGHT - LEFT, H = BOT - TOP;
  const n = months.length;

  const gridEl = [10, 5, 0].map(v => {
    const yv = _yPos(v, TOP, H).toFixed(1);
    const yt = (_yPos(v, TOP, H) + 4).toFixed(0);
    return `<line x1="${LEFT}" y1="${yv}" x2="${RIGHT}" y2="${yv}" class="rd-chart-grid" stroke-dasharray="3,4"/>` +
           `<text x="${LEFT - 5}" y="${yt}" text-anchor="end" class="rd-chart-label">${v}</text>`;
  }).join("");

  const xLabels = months.map((m, i) => {
    const xv = _xPos(i, n, LEFT, W).toFixed(1);
    const label = MONTHS_ES[parseInt(m.slice(5, 7), 10) - 1] || m.slice(5, 7);
    return `<text x="${xv}" y="${BOT + 15}" text-anchor="middle" class="rd-chart-label">${label}</text>`;
  }).join("");

  const svgH = BOT + 26;
  const svg =
    `<svg viewBox="0 0 300 ${svgH}" width="100%" class="rd-chart" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${BOT}" class="rd-chart-axis"/>` +
    gridEl +
    _seriesSVG(workPts, n, LEFT, W, TOP, H, "rd-line-work", "rd-dot-work", "rd-val-work") +
    _seriesSVG(examPts, n, LEFT, W, TOP, H, "rd-line-exam", "rd-dot-exam", "rd-val-exam") +
    xLabels +
    `</svg>`;

  const items = [
    examPts.length ? `<span class="rd-legend-item"><span class="rd-legend-sq rd-legend-sq--exam"></span>Exámenes</span>` : "",
    workPts.length ? `<span class="rd-legend-item"><span class="rd-legend-sq rd-legend-sq--work"></span>Trabajos</span>` : "",
  ].filter(Boolean).join("");

  return svg + `<div class="rd-legend">${items}</div>`;
}
