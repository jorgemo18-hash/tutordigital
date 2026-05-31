import { apiFetch } from "../../shared/js/auth.js";

// ── Constantes ─────────────────────────────────────────────────────────────
const PRICE_PER_TOKEN = 0.000003; // Sonnet aprox ($ → €)

const FEATURES = [
  { key: "img",   label: "Adjunto imagen",      color: "var(--c1)" },
  { key: "pdf",   label: "Adjunto PDF",          color: "var(--c2)" },
  { key: "file",  label: "Adjunto archivo",      color: "var(--c2)" },
  { key: "voice", label: "Voz",                  color: "var(--c3)" },
  { key: "board", label: "Pizarra",              color: "var(--c4)" },
  { key: "calc",  label: "Calculadora",          color: "var(--c3)" },
  { key: "hist",  label: "Historial recuperado", color: "var(--c5)" },
];

const MODES = [
  { key: "DEBERES", label: "Deberes",  color: "var(--c1)" },
  { key: "EXAMEN",  label: "Exámenes", color: "var(--c3)" },
  { key: "TRABAJO", label: "Trabajo",  color: "var(--c4)" },
];

const PERIODS = [
  { key: "7d",    label: "7 días"   },
  { key: "month", label: "Este mes" },
  { key: "year",  label: "Este año" },
  { key: "all",   label: "Total"    },
];

const EMPTY_NOTE = `<div class="sa-empty-note">Sin datos aún · aparecerán cuando haya sesiones reales</div>`;

// ── Generador de días para sparkline ───────────────────────────────────────
function buildDaysForPeriod(period) {
  const now   = new Date();
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

// ── HTML builders ──────────────────────────────────────────────────────────
function buildControls(tenants, activePeriod) {
  const opts  = tenants.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  const chips = PERIODS.map(p =>
    `<button class="chip${p.key === activePeriod ? " active" : ""}" data-period="${p.key}">${p.label}</button>`
  ).join("");
  return `
    <div class="sa-stats-controls">
      <select class="es-tenant-select" id="esTenantSelect">
        <option value="">Todos los centros</option>${opts}
      </select>
      <div class="filter-chips" id="esPeriodChips">${chips}</div>
    </div>`;
}

function buildKPIs() {
  const kpis = [
    { id: "esKpiCost",      label: "Coste IA este mes",       accent: true  },
    { id: "esKpiTokens",    label: "Tokens consumidos",        accent: false },
    { id: "esKpiSessions",  label: "Sesiones con tutor",       accent: false },
    { id: "esKpiEscaladas", label: "Escalaciones al profesor", accent: false },
  ];
  return `
    <div class="sa-stats-metrics">
      ${kpis.map(k => `
        <div class="sa-metric">
          <div class="sa-metric-label">${k.label}</div>
          <div class="sa-metric-value${k.accent ? "" : " sa-metric-value--neutral"}" id="${k.id}">—</div>
          <div class="sa-metric-sub" id="${k.id}Sub"></div>
          ${EMPTY_NOTE}
        </div>`).join("")}
    </div>`;
}

function buildCostsCard() {
  return `
    <div class="sa-card" style="margin-bottom:16px">
      <div class="sa-card-head">
        <span class="sa-card-title">Costes e ingresos</span>
        <span class="sa-card-badge">Beta</span>
      </div>
      <div class="sa-costs-metrics">
        <div class="sa-costs-item">
          <div class="sa-costs-label">Coste IA real</div>
          <div class="sa-costs-value" id="esCostReal">—</div>
          <div class="sa-costs-sub">tokens × tarifa Sonnet</div>
        </div>
        <div class="sa-costs-item">
          <div class="sa-costs-label">Ingresos</div>
          <div class="sa-costs-value sa-costs-value--dim" id="esIngresos">0 €</div>
          <div class="sa-costs-sub">facturación — próximamente</div>
        </div>
        <div class="sa-costs-item">
          <div class="sa-costs-label">Margen estimado</div>
          <div class="sa-costs-value sa-costs-value--dim" id="esMargen">—</div>
          <div class="sa-costs-sub">ingresos − costes</div>
        </div>
      </div>
    </div>`;
}

function buildFeaturesCard() {
  const rows = FEATURES.map(f => `
    <div class="sa-feat-row">
      <span class="sa-feat-label">${f.label}</span>
      <div class="sa-feat-right">
        <div class="sa-feat-track">
          <div class="sa-feat-fill" id="esF-${f.key}" style="width:0%;background:${f.color}"></div>
        </div>
        <div class="sa-feat-meta">
          <span class="sa-feat-pct" id="esFp-${f.key}">0%</span>
          <span class="sa-feat-ratio" id="esFr-${f.key}">0/0</span>
        </div>
      </div>
    </div>`).join("");
  return `
    <div class="sa-card" style="margin-bottom:0">
      <div class="sa-card-head"><span class="sa-card-title">Funciones usadas</span></div>
      <div class="sa-feat-body">
        <div class="sa-feat-sublabel">sobre alumnos con al menos una sesión de chat</div>
        ${rows}
        ${EMPTY_NOTE}
      </div>
    </div>`;
}

function buildDonut() {
  const legend = MODES.map(m => `
    <div class="sa-legend-row">
      <span class="sa-legend-dot" style="background:${m.color}"></span>
      <span class="sa-legend-label">${m.label}</span>
      <span class="sa-legend-ratio" id="esMr-${m.key}">0/0</span>
      <span class="sa-legend-pct" id="esMp-${m.key}">0%</span>
    </div>`).join("");
  return `
    <div class="sa-card" style="margin-bottom:0">
      <div class="sa-card-head"><span class="sa-card-title">Modo más usado</span></div>
      <div class="sa-donut-body">
        <div class="sa-donut" id="esDonut" style="background:#c8c8c8"></div>
        <div class="sa-legend">${legend}</div>
      </div>
      ${EMPTY_NOTE}
    </div>`;
}

function buildSparkline(period) {
  return renderSparklineHTML(buildDaysForPeriod(period));
}

function renderSparklineHTML(days) {
  const max = Math.max(...days.map(d => d.count), 1);
  const bw  = days.length > 0 ? Math.max(2, Math.floor(280 / days.length) - 1) : 8;
  const bars = days.map((d, i) => {
    const h  = d.count > 0 ? Math.max(4, Math.round((d.count / max) * 52)) : 8;
    const op = d.count > 0 ? (0.5 + (d.count / max) * 0.4).toFixed(2) : "0.30";
    return `<rect x="${i * (bw + 1)}" y="${60 - h}" width="${bw}" height="${h}" fill="var(--accent)" opacity="${op}" rx="1"/>`;
  }).join("");
  const lFirst = days[0]?.date || "";
  const lMid   = days[Math.floor(days.length / 2)]?.date || "";
  const lLast  = days[days.length - 1]?.date || "Hoy";
  return `
    <div class="sa-card" style="margin-bottom:0" id="esSparkCard">
      <div class="sa-card-head"><span class="sa-card-title">Sesiones por día</span></div>
      <div class="sa-spark-body">
        <svg viewBox="0 0 280 60" preserveAspectRatio="none" class="sa-bar-sparkline" aria-hidden="true">
          ${bars}
        </svg>
        <div class="sa-spark-labels">
          <span>${lFirst}</span><span>${lMid}</span><span>${lLast}</span>
        </div>
      </div>
      ${EMPTY_NOTE}
    </div>`;
}

// ── Actualizar donut ───────────────────────────────────────────────────────
function updateDonut(modes = {}) {
  const donutEl = document.getElementById("esDonut");
  if (!donutEl) return;
  const total = MODES.reduce((s, m) => s + (modes[m.key] || 0), 0);

  if (total === 0) {
    donutEl.style.background = "#c8c8c8";
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
    const pct  = ((modes[m.key] || 0) / total) * 100;
    const from = acc; acc += pct;
    const r = document.getElementById(`esMr-${m.key}`);
    const p = document.getElementById(`esMp-${m.key}`);
    if (r) r.textContent = `${modes[m.key] || 0}/${total}`;
    if (p) p.textContent = `${Math.round(pct)}%`;
    return `${m.color} ${from.toFixed(1)}% ${acc.toFixed(1)}%`;
  });
  donutEl.style.background = `conic-gradient(${stops.join(", ")})`;
}

// ── Carga de datos ─────────────────────────────────────────────────────────
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
  set("esKpiCostSub",      tokens > 0 && (inTok || outTok) ? `${inTok.toLocaleString()} entrada · ${outTok.toLocaleString()} salida` : "");
  set("esKpiTokens",       tokens > 0 ? tokens.toLocaleString("es-ES") : "—");
  set("esKpiTokensSub",    tokens > 0 && (inTok || outTok) ? `${inTok.toLocaleString()} entrada · ${outTok.toLocaleString()} salida` : "");
  set("esKpiSessions",     sessions > 0 ? sessions : "—");
  set("esKpiSessionsSub",  unique > 0 ? `${unique} alumnos únicos` : "");
  set("esKpiEscaladas",    escal > 0 ? escal : "—");
  set("esKpiEscaladasSub", sessions > 0 ? `de ${sessions} sesiones totales` : "");

  // Costes e ingresos
  set("esCostReal", tokens > 0 ? `${costReal.toFixed(2)} €` : "—");
  set("esIngresos",  "0 €");
  set("esMargen",    tokens > 0 ? `${(0 - costReal).toFixed(2)} €` : "—");

  updateDonut(data.modes || {});
}

// ── Fábrica del módulo ─────────────────────────────────────────────────────
export function createEstadisticasView(panelEl) {
  let initialized    = false;
  let activeTenantId = "";
  let activePeriod   = "month";

  function render(tenants) {
    panelEl.innerHTML =
      `<div class="sa-head">
        <div><h1 class="sa-head-title">Estadísticas</h1></div>
      </div>` +
      buildControls(tenants, activePeriod) +
      buildKPIs() +
      buildCostsCard() +
      `<div class="sa-stats-row2">
        ${buildFeaturesCard()}
        <div class="sa-stats-right">
          ${buildDonut()}
          ${buildSparkline(activePeriod)}
        </div>
      </div>`;
  }

  function wireEvents() {
    const tenantSel = document.getElementById("esTenantSelect");
    const chipsEl   = document.getElementById("esPeriodChips");

    tenantSel?.addEventListener("change", e => {
      activeTenantId = e.target.value;
      loadStats(activeTenantId, activePeriod);
    });

    chipsEl?.addEventListener("click", e => {
      const chip = e.target.closest("[data-period]");
      if (!chip) return;
      chipsEl.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activePeriod = chip.dataset.period;

      const sparkCard = document.getElementById("esSparkCard");
      if (sparkCard) sparkCard.outerHTML = buildSparkline(activePeriod);

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
            tenants.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
        }
      }
      loadStats(activeTenantId, activePeriod);
    },
    hide() {},
  };
}
