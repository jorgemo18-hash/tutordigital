// mobileSuperStats.js — Tab Stats: 4 métricas de IA de este mes (reales,
// GET /api/v1/superadmin/stats), funciones usadas, donut de modo y gráfico
// de sesiones por día. Estas tres últimas secciones no tienen fuente de
// datos en el backend todavía (no hay desglose por función/modo ni serie
// diaria) y muestran el mismo estado vacío honesto que la versión de
// escritorio en vez de cifras inventadas.

import { fetchGlobalStats } from "../mobileSuperData.js";

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

export async function renderSuperStats({ containerEl }) {
  function _draw(stats) {
    const costeIA  = stats.coste_ia_mes ?? 0;
    const tokens   = stats.tokens_mes;
    const sesiones = stats.sesiones_mes || 0;
    const escal    = stats.escalaciones_mes || 0;

    containerEl.innerHTML = `
      <div class="phead">
        <div class="phead-eyebrow">Métricas de uso</div>
        <h1 class="phead-title"><em>Estadísticas</em></h1>
        <div class="phead-meta"><span>Datos globales · este mes</span></div>
      </div>

      <div class="smetrics">
        <div class="smetric featured">
          <span class="smetric-eye">Coste IA este mes</span>
          <span class="smetric-num">${costeIA > 0 ? `${costeIA.toFixed(2)} €` : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>${costeIA > 0 ? "estimación · 0,044 € / sesión" : ""}</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Tokens consumidos</span>
          <span class="smetric-num">${tokens != null ? tokens.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>${tokens == null ? "sin tracking aún" : ""}</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Sesiones con tutor</span>
          <span class="smetric-num">${sesiones > 0 ? sesiones.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span></span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Escalaciones</span>
          <span class="smetric-num">${escal > 0 ? escal.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>${sesiones > 0 ? `${((escal / sesiones) * 100).toFixed(1)}% de sesiones` : ""}</span>
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
            <div class="donut" style="background:#2a2520"></div>
            <div class="legend">
              ${MODES.map(m => `
                <div class="legend-row">
                  <span class="legend-name"><span class="legend-dot" style="background:${m.color}"></span>${m.label}</span>
                  <span class="legend-sub">0/0</span>
                  <span class="legend-pct">0%</span>
                </div>`).join("")}
            </div>
          </div>
          <p class="dcard-empty">Sin datos aún · aparecerán cuando haya sesiones reales.</p>
        </div>
      </div>

      <div class="seclabel"><span class="seclabel-name">Sesiones por día</span><span class="seclabel-line"></span></div>
      <div class="grouplist">
        <div class="gblock">
          <div class="chart">
            <div class="chart-bars"></div>
            <p class="dcard-empty">Sin datos aún · aparecerán cuando haya sesiones reales.</p>
          </div>
        </div>
      </div>`;
  }

  containerEl.innerHTML = `<p class="dcard-empty">Cargando…</p>`;
  const stats = await fetchGlobalStats().catch(() => ({}));
  _draw(stats);
}
