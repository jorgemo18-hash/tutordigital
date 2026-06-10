import { escapeHtml } from "./utils.js";
import { fmtTime, formatNota } from "./notebook-utils.js";

function _scoreAvg(cardGrades, type) {
  const scores = cardGrades
    .filter(g => g._taskType === type)
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

function _barHTML(label, value) {
  const pct = value !== null ? Math.round((value / 10) * 100) : 0;
  return `
    <div class="nbReportBar">
      <div class="nbReportBarMeta">
        <span class="nbReportBarName">${label}</span>
        <span class="nbReportBarValue">${formatNota(value)}</span>
      </div>
      <div class="nbReportBarTrack">
        <div class="nbReportBarFill" style="width:${pct}%"></div>
      </div>
    </div>`;
}

export function buildReportStatsEl({ notaMediaVal, cardGrades, stats, sessionStats }) {
  const examAvg = _scoreAvg(cardGrades, "exam");
  const workAvg = _scoreAvg(cardGrades, "work");
  const pct     = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const pctSolo = stats.total > 0
    ? Math.min(100, Math.round((sessionStats.solvedAlone / stats.total) * 100))
    : 0;

  const el = document.createElement("div");
  el.className = "nbReportStats";
  el.innerHTML = `
    <div class="nbReportNotaGlobal">
      <div class="nbReportNotaNum">${formatNota(notaMediaVal)}</div>
      <div class="nbReportNotaLabel">Nota media global</div>
    </div>
    <div class="nbReportBars">
      ${_barHTML("Exámenes", examAvg)}
      ${_barHTML("Trabajos", workAvg)}
    </div>
    <div class="nbReportPills">
      <div class="nbReportPill">
        <span class="nbReportPillVal">${pct}%</span>
        <span class="nbReportPillLabel">Tareas hechas</span>
      </div>
      <div class="nbReportPill">
        <span class="nbReportPillVal">${fmtTime(sessionStats.totalSecs)}</span>
        <span class="nbReportPillLabel">Tiempo tutor</span>
      </div>
      <div class="nbReportPill">
        <span class="nbReportPillVal">${pctSolo}%</span>
        <span class="nbReportPillLabel">Solo</span>
      </div>
    </div>
  `;
  return el;
}

export function activateReportLayout(area, text, studentId) {
  // Detach pre-rendered stats before clearing innerHTML
  const statsEl = area.querySelector(".nbReportStats");
  if (statsEl) statsEl.remove();

  const narrativeEl = document.createElement("div");
  narrativeEl.className = "nbReportNarrative";
  narrativeEl.innerHTML = `
    <div class="nbReportText">${escapeHtml(text)}</div>
    <div class="nbReportActions">
      <button class="btn ghost nbBtn" data-nb-action="copy-report"
        data-student-id="${studentId}" type="button">Copiar</button>
    </div>
  `;

  area.innerHTML = "";

  if (statsEl) {
    const layout = document.createElement("div");
    layout.className = "nbReportLayout";
    statsEl.style.display = "";
    layout.appendChild(statsEl);
    layout.appendChild(narrativeEl);
    area.appendChild(layout);
    area.closest(".nbStudentCard")?.classList.add("nbStudentCard--wide");
  } else {
    area.appendChild(narrativeEl);
  }
}
