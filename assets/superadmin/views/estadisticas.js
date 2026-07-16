import { apiFetch } from "../../shared/js/auth.js";
import { escHtml } from "../../shared/js/escHtml.js";

// ── Constantes ─────────────────────────────────────────────────────────────
const PRICE_PER_TOKEN = 0.000003;

const FEATURES = [
  { key: "img",   label: "Adjunto imagen" },
  { key: "pdf",   label: "Adjunto PDF" },
  { key: "file",  label: "Adjunto archivo" },
  { key: "voice", label: "Voz" },
  { key: "board", label: "Pizarra" },
  { key: "calc",  label: "Calculadora" },
  { key: "hist",  label: "Historial recuperado" },
];

const MODES = [
  { key: "DEBERES", label: "Deberes",  color: "#d99c66" },
  { key: "EXAMEN",  label: "Exámenes", color: "#8fb2c9" },
  { key: "TRABAJO", label: "Trabajo",  color: "#b99cc9" },
];

const PERIODS = [
  { key: "7d",    label: "7 días"   },
  { key: "month", label: "Este mes" },
  { key: "year",  label: "Este año" },
  { key: "all",   label: "Total"    },
];

const EMPTY = `<div class="sa-empty-note">Sin datos aún · aparecerán cuando haya sesiones reales</div>`;

// ── HTML builders ──────────────────────────────────────────────────────────

function buildHead(tenants, activePeriod) {
  const tenantOpts = tenants.map(t => `<option value="${escHtml(t.id)}">${escHtml(t.name)}</option>`).join("");
  const periodBtns = PERIODS.map(p =>
    `<button class="${p.key === activePeriod ? "active" : ""}" data-period="${p.key}">${p.label}</button>`
  ).join("");
  return `
    <header class="sa-head">
      <div>
        <div class="sa-head-eye">Métricas de uso</div>
        <h1 class="sa-head-title">Estadísticas</h1>
      </div>
      <div class="sa-head-controls">
        <select class="sa-centro-select" id="esTenantSelect">
          <option value="">Todos los centros</option>${tenantOpts}
        </select>
        <div class="sa-seg" id="esPeriodSeg">${periodBtns}</div>
      </div>
    </header>`;
}

function buildKPIs() {
  return `
    <div class="sa-metrics">
      <div class="sa-metric featured">
        <span class="sa-metric-eye">Coste IA este mes</span>
        <span class="sa-metric-num" id="esKpiCost">—</span>
        <span class="sa-metric-foot" id="esKpiCostFoot"><span class="dot"></span></span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Tokens consumidos</span>
        <span class="sa-metric-num" id="esKpiTokens">—</span>
        <span class="sa-metric-foot" id="esKpiTokensFoot"><span class="dot"></span></span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Sesiones con tutor</span>
        <span class="sa-metric-num" id="esKpiSessions">—</span>
        <span class="sa-metric-foot" id="esKpiSessionsFoot"><span class="dot"></span></span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Escalaciones al profesor</span>
        <span class="sa-metric-num" id="esKpiEscal">—</span>
        <span class="sa-metric-foot" id="esKpiEscalFoot"><span class="dot"></span></span>
      </div>
    </div>`;
}

function buildCostsPanel() {
  return `
    <section class="sa-panel">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Costes e ingresos</h2>
          <div class="sa-panel-sub">Análisis financiero del período</div>
        </div>
        <span class="sa-panel-badge">Beta</span>
      </div>
      <div class="sa-costs-metrics">
        <div class="sa-costs-item">
          <div class="sa-costs-label">Coste IA real</div>
          <div class="sa-costs-value" id="esCostReal">—</div>
          <div class="sa-costs-sub">tokens × tarifa Sonnet</div>
        </div>
        <div class="sa-costs-item">
          <div class="sa-costs-label">Ingresos</div>
          <div class="sa-costs-value sa-costs-value--dim" id="esIngresos">—</div>
          <div class="sa-costs-sub">Pendiente de definir precios</div>
        </div>
        <div class="sa-costs-item">
          <div class="sa-costs-label">Margen estimado</div>
          <div class="sa-costs-value sa-costs-value--dim" id="esMargen">—</div>
          <div class="sa-costs-sub">Pendiente de definir precios</div>
        </div>
      </div>
    </section>`;
}

function buildFeaturesPanel() {
  const rows = FEATURES.map(f => `
    <div class="sa-bar-row">
      <span class="sa-bar-label">${f.label}</span>
      <div class="sa-bar-track">
        <div class="sa-bar-fill" id="esF-${f.key}" style="width:0%"></div>
      </div>
      <div>
        <div class="sa-bar-val" id="esFp-${f.key}">0%</div>
        <div class="sa-bar-sub" id="esFr-${f.key}">0/0</div>
      </div>
    </div>`).join("");
  return `
    <section class="sa-panel">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Funciones usadas</h2>
          <div class="sa-panel-sub">% de alumnos con al menos una sesión de chat</div>
        </div>
      </div>
      <div class="sa-bars">${rows}</div>
      ${EMPTY}
    </section>`;
}

function buildModoPanel() {
  const legend = MODES.map(m => `
    <div class="sa-legend-row">
      <span class="sa-legend-name">
        <span class="sa-legend-dot" style="background:${m.color}"></span>${m.label}
      </span>
      <span class="sa-legend-sub" id="esMr-${m.key}">0/0</span>
      <span class="sa-legend-pct" id="esMp-${m.key}">0%</span>
    </div>`).join("");
  return `
    <section class="sa-panel">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Modo más usado</h2>
          <div class="sa-panel-sub">Distribución de sesiones</div>
        </div>
      </div>
      <div class="sa-donut-wrap">
        <div class="sa-donut" id="esDonut" style="background:#2a2520"></div>
        <div class="sa-legend">${legend}</div>
      </div>
      ${EMPTY}
    </section>`;
}

function buildChartPanel(days) {
  const maxVal = Math.max(...days.map(d => d.count), 1);
  const bars = days.map(d =>
    `<div class="sa-chart-bar" style="height:${d.count > 0 ? Math.max(3, Math.round((d.count / maxVal) * 100)) : 3}%" title="${d.count} sesiones"></div>`
  ).join("");
  const first = days[0]?.date || "";
  const mid   = days[Math.floor(days.length / 2)]?.date || "";
  const last  = days[days.length - 1]?.date || "Hoy";
  return `
    <section class="sa-panel" id="esChartPanel">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Sesiones por día</h2>
          <div class="sa-panel-sub">${first} — ${last}</div>
        </div>
      </div>
      <div class="sa-chart">
        <div class="sa-chart-bars" id="esChartBars">${bars}</div>
        <div class="sa-chart-axis">
          <span>${first}</span><span>${mid}</span><span>${last}</span>
        </div>
      </div>
      ${EMPTY}
    </section>`;
}

function buildDaysForPeriod(period) {
  const now    = new Date();
  const fmtDay = d => `${d.getDate()}/${d.getMonth() + 1}`;
  const fmtMon = d => d.toLocaleString("es-ES", { month: "short" });
  const days   = [];
  if (period === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days.push({ date: fmtDay(d), count: 0 });
    }
  } else if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      days.push({ date: fmtMon(d), count: 0 });
    }
  } else {
    const cur = now.getDate();
    for (let i = 1; i <= cur; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      days.push({ date: fmtDay(d), count: 0 });
    }
  }
  return days;
}

// ── Donut update ───────────────────────────────────────────────────────────
function updateDonut(modes = {}) {
  const donutEl = document.getElementById("esDonut");
  if (!donutEl) return;
  const total = MODES.reduce((s, m) => s + (modes[m.key] || 0), 0);
  if (total === 0) {
    donutEl.style.background = "#2a2520";
    MODES.forEach(m => {
      const r = document.getElementById(`esMr-${m.key}`);
      const p = document.getElementById(`esMp-${m.key}`);
      if (r) r.textContent = "0/0";
      if (p) p.textContent = "0%";
    });
    return;
  }
  let acc = 0;
  const stops = MODES.map(m => {
    const pct = ((modes[m.key] || 0) / total) * 100;
    const from = acc; acc += pct;
    const r = document.getElementById(`esMr-${m.key}`);
    const p = document.getElementById(`esMp-${m.key}`);
    if (r) r.textContent = `${modes[m.key] || 0}/${total}`;
    if (p) p.textContent = `${Math.round(pct)}%`;
    return `${m.color} ${from.toFixed(1)}% ${acc.toFixed(1)}%`;
  });
  donutEl.style.background = `conic-gradient(${stops.join(", ")})`;
}

// ── Load stats ─────────────────────────────────────────────────────────────
async function loadStats(tenantId, period) {
  const params = new URLSearchParams({ period });
  if (tenantId) params.set("tenant_id", tenantId);

  let data = {};
  try {
    const res = await apiFetch(`/api/v1/superadmin/stats?${params}`);
    if (res.ok) data = (await res.json().catch(() => ({}))).data || {};
  } catch {}

  const tokens   = data.tokens_total  || 0;
  const inTok    = data.tokens_input  || 0;
  const outTok   = data.tokens_output || 0;
  const sessions = data.sessions      || 0;
  const unique   = data.unique_students || 0;
  const escal    = data.escalaciones  || 0;
  const costReal = tokens * PRICE_PER_TOKEN;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set("esKpiCost",         tokens > 0 ? `${costReal.toFixed(2)} €` : "—");
  set("esKpiCostFoot",     "");
  set("esKpiTokens",       tokens > 0 ? tokens.toLocaleString("es-ES") : "—");
  set("esKpiTokensFoot",   tokens > 0 ? `${inTok.toLocaleString()} entrada · ${outTok.toLocaleString()} salida` : "");
  set("esKpiSessions",     sessions > 0 ? sessions.toLocaleString("es-ES") : "—");
  set("esKpiSessionsFoot", unique > 0 ? `${unique} alumnos únicos` : "");
  set("esKpiEscal",        escal > 0 ? escal.toLocaleString("es-ES") : "—");
  set("esKpiEscalFoot",    sessions > 0 ? `${((escal / sessions) * 100).toFixed(1)}% de las sesiones` : "");

  set("esCostReal", tokens > 0 ? `${costReal.toFixed(2)} €` : "—");
  // Ingresos y Margen quedan siempre en estado neutro — el pricing de
  // TutorDigital no está definido todavía, así que no hay ninguna cifra
  // real (ni siquiera derivada del coste) que mostrar aquí. Un "0 €" o un
  // margen calculado sobre ingresos inventados sería peor que no mostrar
  // nada — ver el texto "Pendiente de definir precios" en buildCostsPanel.
  // Cuando exista el pricing, este set() pasa a leer el valor real del
  // backend en vez de un literal fijo.
  set("esIngresos", "—");
  set("esMargen",   "—");

  updateDonut(data.modes || {});

  // Update chart bars if days data available
  if (data.sessions_by_day) {
    const bars = document.getElementById("esChartBars");
    if (bars) {
      const maxVal = Math.max(...data.sessions_by_day.map(d => d.count || d), 1);
      bars.innerHTML = data.sessions_by_day.map(d => {
        const count = typeof d === "object" ? d.count : d;
        return `<div class="sa-chart-bar" style="height:${count > 0 ? Math.max(3, Math.round((count / maxVal) * 100)) : 3}%" title="${count} sesiones"></div>`;
      }).join("");
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────────────
export function createEstadisticasView(panelEl) {
  let initialized    = false;
  let activeTenantId = "";
  let activePeriod   = "month";

  function render(tenants) {
    const days = buildDaysForPeriod(activePeriod);
    panelEl.innerHTML =
      buildHead(tenants, activePeriod) +
      buildKPIs() +
      buildCostsPanel() +
      `<div class="sa-two">
        ${buildFeaturesPanel()}
        <div class="sa-col-stack">
          ${buildModoPanel()}
          ${buildChartPanel(days)}
        </div>
      </div>`;
  }

  function wireEvents() {
    document.getElementById("esTenantSelect")?.addEventListener("change", e => {
      activeTenantId = e.target.value;
      loadStats(activeTenantId, activePeriod);
    });

    document.getElementById("esPeriodSeg")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-period]");
      if (!btn) return;
      document.querySelectorAll("#esPeriodSeg button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activePeriod = btn.dataset.period;

      const chartPanel = document.getElementById("esChartPanel");
      if (chartPanel) {
        const days = buildDaysForPeriod(activePeriod);
        const maxVal = 1;
        const bars = days.map(d =>
          `<div class="sa-chart-bar" style="height:3%" title="0 sesiones"></div>`
        ).join("");
        const barsEl = document.getElementById("esChartBars");
        if (barsEl) barsEl.innerHTML = bars;
      }

      loadStats(activeTenantId, activePeriod);
    });
  }

  return {
    init(tenants = []) {
      if (!initialized) {
        render(tenants);
        wireEvents();
        initialized = true;
      } else {
        const sel = document.getElementById("esTenantSelect");
        if (sel) {
          sel.innerHTML = `<option value="">Todos los centros</option>` +
            tenants.map(t => `<option value="${escHtml(t.id)}">${escHtml(t.name)}</option>`).join("");
        }
      }
      loadStats(activeTenantId, activePeriod);
    },
    hide() {},
  };
}
