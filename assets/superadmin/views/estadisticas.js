import { apiFetch } from "../../shared/js/auth.js";
import { escHtml } from "../../shared/js/escHtml.js";

// ── Constantes ─────────────────────────────────────────────────────────────
// sesion_libre es un tipo de tarea real (ver tasks.type) — porción propia
// en el donut con su color y leyenda, nunca agrupada en "otros": agruparla
// la haría invisible justo cuando interese medirla.
const MODES = [
  { key: "DEBERES",      label: "Deberes",      color: "#d99c66" },
  { key: "EXAMEN",       label: "Exámenes",     color: "#8fb2c9" },
  { key: "TRABAJO",      label: "Trabajo",      color: "#b99cc9" },
  { key: "SESION_LIBRE", label: "Sesión libre", color: "#c9a98f" },
];

const PERIODS = [
  { key: "7d",    label: "7 días"   },
  { key: "month", label: "Este mes" },
  { key: "year",  label: "Este año" },
  { key: "all",   label: "Total"    },
];

// El gráfico diario solo existe para rangos acotados (7d/month) — para
// year/all el backend no lo calcula (ver superadmin.stats.routes.js:
// un histograma diario sobre un rango sin límite no es una agregación
// simple y correcta a cualquier volumen), así que aquí tampoco se finge uno.
const PERIODS_CON_GRAFICO_DIARIO = new Set(["7d", "month"]);

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
        <span class="sa-metric-eye">Coste IA</span>
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
          <div class="sa-costs-sub" id="esCostRealSub">tokens × tarifa por modelo</div>
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
      <div id="esModoEmpty">${EMPTY}</div>
    </section>`;
}

function buildChartPanel(period) {
  if (!PERIODS_CON_GRAFICO_DIARIO.has(period)) {
    return `
      <section class="sa-panel" id="esChartPanel">
        <div class="sa-panel-head">
          <div>
            <h2 class="sa-panel-title">Sesiones por día</h2>
            <div class="sa-panel-sub">No disponible para este rango</div>
          </div>
        </div>
        <div class="sa-empty-note">El desglose diario solo está disponible para "7 días" y "Este mes" — para rangos más largos, usa los números totales de arriba.</div>
      </section>`;
  }
  return `
    <section class="sa-panel" id="esChartPanel">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Sesiones por día</h2>
          <div class="sa-panel-sub" id="esChartRange"></div>
        </div>
      </div>
      <div class="sa-chart">
        <div class="sa-chart-bars" id="esChartBars"></div>
        <div class="sa-chart-axis" id="esChartAxis"></div>
      </div>
      <div id="esChartEmpty">${EMPTY}</div>
    </section>`;
}

// ── Donut update ───────────────────────────────────────────────────────────
function updateDonut(modes = {}) {
  const donutEl = document.getElementById("esDonut");
  if (!donutEl) return;
  const total = MODES.reduce((s, m) => s + (modes[m.key] || 0), 0);
  const emptyNote = document.getElementById("esModoEmpty");
  if (emptyNote) emptyNote.style.display = total === 0 ? "" : "none";
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

// ── Chart update ───────────────────────────────────────────────────────────
function updateChart(sessionsByDay) {
  const barsEl  = document.getElementById("esChartBars");
  const axisEl  = document.getElementById("esChartAxis");
  const rangeEl = document.getElementById("esChartRange");
  const emptyEl = document.getElementById("esChartEmpty");
  if (!barsEl) return; // periodo sin gráfico (year/all) — el panel ni lo pinta

  const days = Array.isArray(sessionsByDay) ? sessionsByDay : [];
  if (emptyEl) emptyEl.style.display = days.length === 0 ? "" : "none";

  const maxVal = Math.max(...days.map(d => d.count), 1);
  barsEl.innerHTML = days.map(d =>
    `<div class="sa-chart-bar" style="height:${d.count > 0 ? Math.max(3, Math.round((d.count / maxVal) * 100)) : 3}%" title="${d.count} sesiones (${d.date})"></div>`
  ).join("");

  if (axisEl) {
    const first = days[0]?.date || "";
    const last  = days[days.length - 1]?.date || "";
    axisEl.innerHTML = days.length ? `<span>${first}</span><span>${last}</span>` : "";
  }
  if (rangeEl) {
    const first = days[0]?.date || "";
    const last  = days[days.length - 1]?.date || "";
    rangeEl.textContent = days.length ? `${first} — ${last}` : "";
  }
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

  // tokens_mes/coste_ia_mes son null cuando ai_token_usage no tiene NINGÚN
  // dato para este periodo/tenant (función recién desplegada, o sin tráfico
  // de IA todavía) — distinto de un 0 real (tracking activo, consumo cero).
  // No tratar null como 0 — ver server/routes/v1/superadmin.stats.routes.js.
  const tokens   = data.tokens_mes;
  const inTok    = data.tokens_input_mes  || 0;
  const outTok   = data.tokens_output_mes || 0;
  const costEur  = data.coste_ia_mes;
  const sesiones = data.sesiones_mes || 0;
  const unique   = data.unique_students || 0;
  const escal    = data.escalaciones_mes || 0;
  const sinTracking = data.tokens_tracking_desde == null;
  const notaTokens  = sinTracking
    ? "sin tracking aún"
    : data.tokens_periodo_parcial ? "periodo parcial · tracking recién activado" : "";

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set("esKpiCost",         costEur != null ? `${costEur.toFixed(2)} €` : "—");
  set("esKpiCostFoot",     costEur != null ? "consumo real" : notaTokens);
  set("esKpiTokens",       tokens != null ? tokens.toLocaleString("es-ES") : "—");
  set("esKpiTokensFoot",   tokens != null ? `${inTok.toLocaleString()} entrada · ${outTok.toLocaleString()} salida` : notaTokens);
  set("esKpiSessions",     sesiones > 0 ? sesiones.toLocaleString("es-ES") : "—");
  set("esKpiSessionsFoot", unique > 0 ? `${unique} alumnos únicos` : "");
  set("esKpiEscal",        escal > 0 ? escal.toLocaleString("es-ES") : "—");
  set("esKpiEscalFoot",    sesiones > 0 ? `${((escal / sesiones) * 100).toFixed(1)}% de las sesiones` : "");

  set("esCostReal", costEur != null ? `${costEur.toFixed(2)} €` : "—");
  set("esCostRealSub", costEur != null ? "tokens × tarifa por modelo" : notaTokens || "tokens × tarifa por modelo");
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
  updateChart(data.sessions_by_day);
}

// ── Factory ────────────────────────────────────────────────────────────────
export function createEstadisticasView(panelEl) {
  let initialized    = false;
  let activeTenantId = "";
  let activePeriod   = "month";

  function render(tenants) {
    panelEl.innerHTML =
      buildHead(tenants, activePeriod) +
      buildKPIs() +
      buildCostsPanel() +
      `<div class="sa-two">
        ${buildModoPanel()}
        ${buildChartPanel(activePeriod)}
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

      // El panel "Sesiones por día" cambia de forma entera según el periodo
      // (con gráfico o "no disponible") — se repinta, no se actualiza in-place.
      const chartPanel = document.getElementById("esChartPanel");
      if (chartPanel) chartPanel.outerHTML = buildChartPanel(activePeriod);

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
