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
  { key: "7d",    label: "7 días"    },
  { key: "month", label: "Este mes"  },
  { key: "year",  label: "Este año"  },
  { key: "all",   label: "Total"     },
];

const EMPTY_NOTE = `<div class="es-empty-note">Sin datos aún · los datos aparecerán cuando haya sesiones reales</div>`;

// ── Generador de días para sparkline ───────────────────────────────────────
function buildDaysForPeriod(period) {
  const now = new Date();
  const fmtDay = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
  const fmtMon = (d) => d.toLocaleString("es-ES", { month: "short" });
  const days = [];

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
  } else { // month / all
    const cur = now.getDate();
    for (let i = 1; i <= cur; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      days.push({ date: fmtDay(d), count: 0 });
    }
  }
  return days;
}

// ── HTML builders ──────────────────────────────────────────────────────────
function buildControls(tenants) {
  const opts = tenants.map(t =>
    `<option value="${t.id}">${t.name}</option>`
  ).join("");
  const chips = PERIODS.map(p =>
    `<button class="chip${p.key === "month" ? " active" : ""}" data-period="${p.key}">${p.label}</button>`
  ).join("");
  return `
    <div class="es-controls">
      <select class="es-tenant-select" id="esTenantSelect">
        <option value="">Todos los centros</option>
        ${opts}
      </select>
      <div class="filter-chips" id="esPeriodChips">${chips}</div>
    </div>`;
}

function buildKPIs() {
  const kpis = [
    { id: "esKpiCost",      label: "Coste IA este mes",        accent: true,  sub: "" },
    { id: "esKpiTokens",    label: "Tokens consumidos",         accent: false, sub: "sin datos aún" },
    { id: "esKpiSessions",  label: "Sesiones con tutor",        accent: false, sub: "" },
    { id: "esKpiEscaladas", label: "Escalaciones al profesor",  accent: false, sub: "" },
  ];
  return `<div class="metrics">${kpis.map(k => `
    <div class="metric-card">
      <div class="metric-label">${k.label}</div>
      <div class="metric-value${k.accent ? "" : " es-kpi-neutral"}" id="${k.id}">—</div>
      <div class="metric-sub" id="${k.id}Sub">${k.sub}</div>
      ${EMPTY_NOTE}
    </div>`).join("")}
  </div>`;
}

function buildFeaturesCard() {
  const rows = FEATURES.map(f => `
    <div class="es-feat-row">
      <span class="es-feat-label">${f.label}</span>
      <div class="es-feat-right">
        <div class="es-feat-track">
          <div class="es-feat-fill" id="esF-${f.key}" style="width:0%;background:${f.color}"></div>
        </div>
        <div class="es-feat-meta">
          <span class="es-feat-pct" id="esFp-${f.key}">0%</span>
          <span class="es-feat-ratio" id="esFr-${f.key}">0/0</span>
        </div>
      </div>
    </div>`).join("");
  return `
    <div class="table-card">
      <div class="table-header">
        <span class="table-title">Funciones usadas</span>
      </div>
      <div class="es-feat-body">
        <div class="es-feat-sublabel">sobre alumnos con al menos una sesión de chat</div>
        ${rows}
        ${EMPTY_NOTE}
      </div>
    </div>`;
}

function buildDonut() {
  const legend = MODES.map(m => `
    <div class="es-legend-row">
      <span class="es-legend-dot" style="background:${m.color}"></span>
      <span class="es-legend-label">${m.label}</span>
      <span class="es-legend-ratio" id="esMr-${m.key}">0/0</span>
      <span class="es-legend-pct" id="esMp-${m.key}">0%</span>
    </div>`).join("");
  return `
    <div class="table-card">
      <div class="table-header"><span class="table-title">Modo más usado</span></div>
      <div class="es-donut-body">
        <div class="es-donut" id="esDonut" style="background:rgba(255,255,255,0.15)"></div>
        <div class="es-legend">${legend}</div>
      </div>
      ${EMPTY_NOTE}
    </div>`;
}

function buildSparkline(period) {
  const days = buildDaysForPeriod(period);
  return renderSparklineHTML(days);
}

function renderSparklineHTML(days) {
  const max = Math.max(...days.map(d => d.count), 1);
  const bw  = days.length > 0 ? Math.max(2, Math.floor(280 / days.length) - 1) : 8;
  const bars = days.map((d, i) => {
    const h   = d.count > 0 ? Math.max(4, Math.round((d.count / max) * 52)) : 8;
    const op  = d.count > 0 ? (0.5 + (d.count / max) * 0.4).toFixed(2) : "0.30";
    return `<rect x="${i * (bw + 1)}" y="${60 - h}" width="${bw}" height="${h}" fill="var(--accent)" opacity="${op}" rx="1"/>`;
  }).join("");
  const lFirst = days[0]?.date || "";
  const lMid   = days[Math.floor(days.length / 2)]?.date || "";
  const lLast  = days[days.length - 1]?.date || "Hoy";
  return `
    <div class="table-card">
      <div class="table-header"><span class="table-title">Sesiones por día</span></div>
      <div class="es-spark-body">
        <svg viewBox="0 0 280 60" preserveAspectRatio="none" class="es-bar-sparkline" aria-hidden="true">
          ${bars}
        </svg>
        <div class="es-spark-labels">
          <span>${lFirst}</span><span>${lMid}</span><span>${lLast}</span>
        </div>
      </div>
      ${EMPTY_NOTE}
    </div>`;
}

// ── Actualizar donut con datos reales ──────────────────────────────────────
function updateDonut(modes = {}) {
  const donutEl = document.getElementById("esDonut");
  if (!donutEl) return;
  const total = MODES.reduce((s, m) => s + (modes[m.key] || 0), 0);

  if (total === 0) {
    donutEl.style.background = "rgba(255,255,255,0.15)";
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

// ── Carga de datos (sin endpoint aún → estado vacío) ───────────────────────
async function loadStats(tenantId, period) {
  // TODO: conectar cuando exista /api/v1/superadmin/stats
  // Por ahora muestra estado vacío sin datos inventados.
  const data = {};

  // KPIs
  const tokens  = data.tokens_total || 0;
  const inTok   = data.tokens_input || 0;
  const outTok  = data.tokens_output || 0;
  const sessions = data.sessions || 0;
  const unique   = data.unique_students || 0;
  const escal    = data.escalaciones || 0;
  const cost     = tokens * PRICE_PER_TOKEN;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set("esKpiCost",      tokens > 0 ? `${cost.toFixed(2)} €` : "—");
  set("esKpiTokens",    tokens > 0 ? tokens.toLocaleString("es-ES") : "—");
  set("esKpiTokensSub", tokens > 0 && (inTok || outTok) ? `${inTok.toLocaleString()} entrada · ${outTok.toLocaleString()} salida` : "sin datos aún");
  set("esKpiSessions",  sessions > 0 ? sessions : "—");
  set("esKpiSessionsSub", unique > 0 ? `${unique} alumnos únicos` : "");
  set("esKpiEscaladas", escal > 0 ? escal : "—");
  set("esKpiEscaladasSub", sessions > 0 ? `de ${sessions} sesiones totales` : "");

  // Features (sin datos)
  updateDonut(data.modes || {});
}

// ── Fábrica del módulo ─────────────────────────────────────────────────────
export function createEstadisticasView(panelEl) {
  let initialized = false;
  let activeTenantId = "";
  let activePeriod   = "month";
  let cachedTenants  = [];

  function renderTopbarControls(tenants) {
    const slot = document.getElementById("saStatsControls");
    if (!slot) return;
    const opts = tenants.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    const chips = PERIODS.map(p =>
      `<button class="chip${p.key === activePeriod ? " active" : ""}" data-period="${p.key}">${p.label}</button>`
    ).join("");
    slot.innerHTML = `
      <select class="es-tenant-select" id="esTenantSelect">
        <option value="">Todos los centros</option>${opts}
      </select>
      <div class="filter-chips" id="esPeriodChips">${chips}</div>`;
    slot.hidden = false;
  }

  function render() {
    panelEl.innerHTML =
      buildKPIs() +
      `<div class="es-row2">
        ${buildFeaturesCard()}
        <div class="es-right-col">
          ${buildDonut()}
          ${buildSparkline(activePeriod)}
        </div>
      </div>`;
  }

  function wireEvents() {
    const tenantSel = document.getElementById("esTenantSelect");
    const chipsEl   = document.getElementById("esPeriodChips");

    tenantSel?.addEventListener("change", (e) => {
      activeTenantId = e.target.value;
      loadStats(activeTenantId, activePeriod);
    });

    chipsEl?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-period]");
      if (!chip) return;
      chipsEl.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activePeriod = chip.dataset.period;
      const rightCol = panelEl.querySelector(".es-right-col");
      const sparkCard = rightCol?.querySelector(".table-card:last-child");
      if (sparkCard) sparkCard.outerHTML = buildSparkline(activePeriod);
      loadStats(activeTenantId, activePeriod);
    });
  }

  return {
    init(tenants = []) {
      cachedTenants = tenants;
      if (!initialized) {
        renderTopbarControls(tenants);
        render();
        wireEvents();
        initialized = true;
      } else {
        // Actualizar opciones del select si cambiaron los tenants
        const sel = document.getElementById("esTenantSelect");
        if (sel) {
          sel.innerHTML = `<option value="">Todos los centros</option>` +
            tenants.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
        }
      }
      loadStats(activeTenantId, activePeriod);
    },
    hide() {
      const slot = document.getElementById("saStatsControls");
      if (slot) slot.hidden = true;
    },
  };
}
