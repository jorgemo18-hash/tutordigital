// mobileSuperStats.js — Tab Stats: rango (7d/Mes/Año/Total), 4 métricas de
// IA, funciones usadas, donut de modo, gráfico de sesiones por día. La
// fuente real (GET /api/v1/superadmin/stats) no existe en el backend
// todavía — ver TODO en mobileSuperData.js — así que esta tab muestra el
// mismo estado vacío honesto que la versión de escritorio en vez de cifras
// inventadas.

import { fetchGlobalStats } from "../mobileSuperData.js";

const PERIODS = [
  { k: "7d",    label: "7 días" },
  { k: "mes",   label: "Mes"    },
  { k: "año",   label: "Año"    },
  { k: "total", label: "Total"  },
];

const FEATURES = [
  "Adjunto imagen", "Calculadora", "Adjunto PDF", "Pizarra",
  "Adjunto archivo", "Voz", "Historial recuperado",
];

const MODES = [
  { key: "DEBERES", label: "Deberes",  color: "#d99c66" },
  { key: "EXAMEN",  label: "Exámenes", color: "#8fb2c9" },
  { key: "TRABAJO", label: "Trabajo",  color: "#b99cc9" },
];

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _conicGradient(modes) {
  const total = MODES.reduce((s, m) => s + (modes[m.key] || 0), 0);
  if (!total) return "#2a2520";
  let acc = 0;
  const stops = MODES.map(m => {
    const pct = ((modes[m.key] || 0) / total) * 100;
    const from = acc; acc += pct;
    return `${m.color} ${from.toFixed(1)}% ${acc.toFixed(1)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export async function renderSuperStats({ containerEl }) {
  let range = "mes";

  function _draw(stats) {
    const tokens   = stats.tokens_total || 0;
    const sessions = stats.sessions || 0;
    const unique   = stats.unique_students || 0;
    const escal    = stats.escalaciones || 0;
    const costReal = tokens * 0.000003;
    const modes    = stats.modes || {};
    const totalModes = MODES.reduce((s, m) => s + (modes[m.key] || 0), 0);
    const days     = stats.sessions_by_day || [];
    const maxDia   = Math.max(1, ...days.map(d => d.count || 0));

    containerEl.innerHTML = `
      <div class="phead">
        <div class="phead-eyebrow">Métricas de uso</div>
        <h1 class="phead-title"><em>Estadísticas</em></h1>
        <div class="phead-meta"><span>Datos globales</span></div>
      </div>

      <div class="segmented">
        ${PERIODS.map(p => `<button type="button" class="seg${range === p.k ? " active" : ""}" data-range="${p.k}">${p.label}</button>`).join("")}
      </div>

      <div class="smetrics">
        <div class="smetric featured">
          <span class="smetric-eye">Coste IA este mes</span>
          <span class="smetric-num">${tokens > 0 ? `${costReal.toFixed(2)} €` : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>0,000003 € / token</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Tokens consumidos</span>
          <span class="smetric-num">${tokens > 0 ? tokens.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>${tokens > 0 ? "entrada + salida" : ""}</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Sesiones con tutor</span>
          <span class="smetric-num">${sessions > 0 ? sessions.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>${unique > 0 ? `${unique} alumnos únicos` : ""}</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Escalaciones</span>
          <span class="smetric-num">${escal > 0 ? escal.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>${sessions > 0 ? `${((escal / sessions) * 100).toFixed(1)}% de sesiones` : ""}</span>
        </div>
      </div>

      <div class="seclabel"><span class="seclabel-name">Funciones usadas</span><span class="seclabel-line"></span></div>
      <div class="grouplist">
        <div class="gblock">
          <div class="sbars">
            ${FEATURES.map(label => `
              <div class="sbar-row">
                <div class="sbar-top"><span class="sbar-label">${_esc(label)}</span><span class="sbar-val">0%</span></div>
                <div class="sbar-track"><div class="sbar-fill" style="width:0%"></div></div>
                <div class="sbar-sub">0 / 0 alumnos</div>
              </div>`).join("")}
          </div>
          <p class="dcard-empty">Sin datos aún · aparecerán cuando haya sesiones reales.</p>
        </div>
      </div>

      <div class="seclabel"><span class="seclabel-name">Modo más usado</span><span class="seclabel-line"></span></div>
      <div class="grouplist">
        <div class="gblock">
          <div class="donut-wrap">
            <div class="donut" style="background:${_conicGradient(modes)}"></div>
            <div class="legend">
              ${MODES.map(m => `
                <div class="legend-row">
                  <span class="legend-name"><span class="legend-dot" style="background:${m.color}"></span>${m.label}</span>
                  <span class="legend-sub">${modes[m.key] || 0}/${totalModes}</span>
                  <span class="legend-pct">${totalModes ? Math.round(((modes[m.key] || 0) / totalModes) * 100) : 0}%</span>
                </div>`).join("")}
            </div>
          </div>
          ${totalModes ? "" : `<p class="dcard-empty">Sin datos aún · aparecerán cuando haya sesiones reales.</p>`}
        </div>
      </div>

      <div class="seclabel"><span class="seclabel-name">Sesiones por día</span><span class="seclabel-line"></span></div>
      <div class="grouplist">
        <div class="gblock">
          <div class="chart">
            <div class="chart-bars">
              ${days.length ? days.map(d => `<div class="chart-bar" style="height:${Math.max(3, Math.round((d.count / maxDia) * 100))}%" title="${d.count} sesiones"></div>`).join("") : ""}
            </div>
            ${days.length ? `<div class="chart-axis"><span>${_esc(days[0]?.date || "")}</span><span>${_esc(days[days.length - 1]?.date || "")}</span></div>` : `<p class="dcard-empty">Sin datos aún · aparecerán cuando haya sesiones reales.</p>`}
          </div>
        </div>
      </div>`;

    containerEl.querySelectorAll("[data-range]").forEach(btn => btn.addEventListener("click", () => { range = btn.dataset.range; _load(); }));
  }

  async function _load() {
    const stats = await fetchGlobalStats(range).catch(() => ({}));
    _draw(stats);
  }

  containerEl.innerHTML = `<p class="dcard-empty">Cargando…</p>`;
  await _load();
}
