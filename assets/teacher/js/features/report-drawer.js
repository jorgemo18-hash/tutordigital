import { formatStudentName, normalizeStudent } from "../state.js";
import { fmtTime, formatNota } from "../notebook-utils.js";
import { apiFetch } from "../../../shared/js/auth.js";
import { getNotebookRangeParams } from "../api/teacherApiHelpers.js";
import { getReportStats } from "../notebook-cards.js";

let _overlay = null;
let _panel = null;

function _esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _scoreAvg(cardGrades, type) {
  const scores = (cardGrades || [])
    .filter(g => g._taskType === type)
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

function _svgChart(examAvg, workAvg) {
  const TOP = 16, BOT = 104, H = BOT - TOP;

  function bar(val, cx, barCls, valCls) {
    if (val === null) {
      return `<text x="${cx}" y="${BOT - 6}" text-anchor="middle" class="${valCls}" font-size="12">—</text>`;
    }
    const h = Math.max(3, (val / 10) * H);
    const y = BOT - h;
    return `<rect x="${cx - 18}" y="${y}" width="36" height="${h}" rx="3" class="${barCls}"/>
      <text x="${cx}" y="${y - 5}" text-anchor="middle" class="${valCls}" font-size="11" font-weight="500">${val.toFixed(1)}</text>`;
  }

  const mid = TOP + H / 2;
  return `<svg viewBox="0 0 180 140" width="100%" class="rd-chart" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <line x1="32" y1="${TOP}" x2="32" y2="${BOT}" class="rd-chart-axis"/>
    <line x1="32" y1="${TOP}" x2="165" y2="${TOP}" class="rd-chart-grid" stroke-dasharray="3,4"/>
    <line x1="32" y1="${mid}" x2="165" y2="${mid}" class="rd-chart-grid" stroke-dasharray="3,4"/>
    <line x1="32" y1="${BOT}" x2="165" y2="${BOT}" class="rd-chart-grid" stroke-dasharray="3,4"/>
    <text x="28" y="${TOP + 4}" text-anchor="end" class="rd-chart-label">10</text>
    <text x="28" y="${mid + 4}" text-anchor="end" class="rd-chart-label">5</text>
    <text x="28" y="${BOT + 4}" text-anchor="end" class="rd-chart-label">0</text>
    ${bar(examAvg, 72, "rd-bar-exam", "rd-bar-val-exam")}
    ${bar(workAvg, 130, "rd-bar-work", "rd-bar-val-work")}
    <text x="72" y="126" text-anchor="middle" class="rd-chart-label">Exámenes</text>
    <text x="130" y="126" text-anchor="middle" class="rd-chart-label">Trabajos</text>
  </svg>`;
}

function _statsHTML({ notaMediaVal, cardGrades, stats, sessionStats }) {
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const pctSolo = stats.total > 0
    ? Math.min(100, Math.round((sessionStats.solvedAlone / stats.total) * 100))
    : 0;
  return `
    <div class="dd-sect">
      <span class="dd-sect-eye">Estadísticas del trimestre</span>
      <div class="rd-nota-global">
        <div class="rd-nota-num">${formatNota(notaMediaVal)}</div>
        <div class="rd-nota-label">Nota media global</div>
      </div>
      ${_svgChart(_scoreAvg(cardGrades, "exam"), _scoreAvg(cardGrades, "work"))}
      <div class="rd-chips">
        <div class="dd-chip"><em>Tareas hechas</em>${pct}%</div>
        <div class="dd-chip"><em>Tiempo tutor</em>${fmtTime(sessionStats.totalSecs)}</div>
        <div class="dd-chip"><em>Resolvió solo</em>${pctSolo}%</div>
      </div>
    </div>`;
}

function _init() {
  if (_overlay) return;
  _overlay = document.createElement("div");
  _overlay.className = "dd-overlay";
  _panel = document.createElement("div");
  _panel.className = "dd-panel";
  _panel.setAttribute("role", "dialog");
  _panel.setAttribute("aria-modal", "true");
  _overlay.appendChild(_panel);
  document.body.appendChild(_overlay);
  _overlay.addEventListener("click", e => { if (e.target === _overlay) closeReportDrawer(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _overlay?.classList.contains("open")) closeReportDrawer();
  });
}

export function closeReportDrawer() {
  _overlay?.classList.remove("open");
  _panel?.classList.remove("open");
}

export function openReportDrawer(ctx, { studentId, groupId }) {
  _init();
  const student = ctx.state.data.students?.find(s => String(s.id) === String(studentId));
  const studentName = student ? formatStudentName(normalizeStudent(student)) : "Alumno";
  const cached = getReportStats(studentId);
  const termNum = { t1: 1, t2: 2, t3: 3 }[ctx.state.notebookTerm] || 1;
  const subjectName = ctx.state.currentSubjectFilter || "";

  const statsSection = cached
    ? _statsHTML(cached)
    : `<div class="dd-sect"><span class="dd-sect-eye">Estadísticas</span><p class="hint">No hay datos disponibles.</p></div>`;

  _panel.innerHTML = `
    <div class="dd-head">
      <div class="dd-head-top">
        <span class="dd-name">${_esc(studentName)}</span>
        <button class="dd-close" type="button" aria-label="Cerrar">×</button>
      </div>
    </div>
    <div class="dd-body">
      ${statsSection}
      <div class="dd-sect" id="rdReportSect_${_esc(studentId)}">
        <span class="dd-sect-eye">Informe narrativo</span>
        <p class="hint" style="margin:8px 0">Cargando informe…</p>
      </div>
    </div>
  `;

  _panel.querySelector(".dd-close").addEventListener("click", closeReportDrawer);
  _overlay.classList.add("open");
  _panel.classList.add("open");

  _loadReport(ctx, { studentId, groupId, termNum, subjectName });
}

async function _loadReport(ctx, { studentId, groupId, termNum, subjectName }) {
  const sect = _panel?.querySelector(`#rdReportSect_${studentId}`);
  if (!sect) return;

  const qs = new URLSearchParams({ studentId, trimester: String(termNum), subjectName });
  try {
    const res = await apiFetch(`/api/v1/reports/trimester?${qs}`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const text = body?.data?.narrative || "";
      if (text) {
        _showNarrative(sect, text, studentId,
          () => _generate(ctx, { studentId, groupId, termNum, subjectName, sect }));
        return;
      }
    }
  } catch {}

  await _generate(ctx, { studentId, groupId, termNum, subjectName, sect });
}

async function _generate(ctx, { studentId, groupId, termNum, subjectName, sect }) {
  if (!sect) return;
  sect.innerHTML = `<span class="dd-sect-eye">Informe narrativo</span><p class="hint" style="margin:8px 0">Generando informe…</p>`;

  const range = getNotebookRangeParams(ctx.state);
  try {
    const res = await apiFetch("/api/v1/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, group_id: groupId, from: range.from, to: range.to }),
    });
    const body = await res.json().catch(() => ({}));
    const text = body?.data?.narrative || "";
    if (!text) {
      sect.innerHTML = `<span class="dd-sect-eye">Informe narrativo</span><p class="hint" style="margin:8px 0;color:#ffb4a4">No se pudo generar el informe.</p>`;
      return;
    }
    apiFetch("/api/v1/reports/trimester", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, group_id: groupId, trimester: termNum, subject_name: subjectName, narrative: text }),
    }).catch(() => {});
    _showNarrative(sect, text, studentId,
      () => _generate(ctx, { studentId, groupId, termNum, subjectName, sect }));
  } catch {
    sect.innerHTML = `<span class="dd-sect-eye">Informe narrativo</span><p class="hint" style="margin:8px 0;color:#ffb4a4">Error de conexión.</p>`;
  }
}

function _showNarrative(sect, text, studentId, onRegenerate) {
  sect.innerHTML = `
    <span class="dd-sect-eye">Informe narrativo</span>
    <div class="nbReportText">${_esc(text)}</div>
    <div class="dd-foot">
      <button class="btn ghost nbBtn" type="button" id="rdCopyBtn_${_esc(studentId)}">Copiar</button>
      <button class="btn ghost nbBtn rd-regen-btn" type="button" id="rdRegenBtn_${_esc(studentId)}">Regenerar informe</button>
    </div>
  `;
  sect.querySelector(`#rdCopyBtn_${studentId}`)?.addEventListener("click", () => {
    navigator.clipboard.writeText(text).catch(() => {});
  });
  sect.querySelector(`#rdRegenBtn_${studentId}`)?.addEventListener("click", onRegenerate);
}
