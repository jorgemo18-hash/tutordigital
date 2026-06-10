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

function _barHTML(label, value) {
  const pct = value !== null ? Math.round((value / 10) * 100) : 0;
  return `
    <div class="rd-bar">
      <div class="rd-bar-meta">
        <span class="rd-bar-label">${label}</span>
        <span class="rd-bar-value">${formatNota(value)}</span>
      </div>
      <div class="rd-bar-track"><div class="rd-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
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
      <div class="rd-bars">
        ${_barHTML("Exámenes", _scoreAvg(cardGrades, "exam"))}
        ${_barHTML("Trabajos", _scoreAvg(cardGrades, "work"))}
      </div>
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

  _overlay.addEventListener("click", e => {
    if (e.target === _overlay) closeReportDrawer();
  });
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
  const range = getNotebookRangeParams(ctx.state);

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
        <div class="nbAiContent">
          <div>
            <div class="nbAiTitle">Resumen narrativo</div>
            <div class="nbAiSub">La IA escribe un informe a partir de estos datos</div>
          </div>
          <button class="nbAiBtn" type="button" id="rdGenerateBtn_${_esc(studentId)}">✦ Generar informe IA</button>
        </div>
      </div>
    </div>
  `;

  _panel.querySelector(".dd-close").addEventListener("click", closeReportDrawer);
  _panel.querySelector(`#rdGenerateBtn_${studentId}`)?.addEventListener("click", () => {
    _runGenerate({ studentId, groupId, range });
  });

  _overlay.classList.add("open");
  _panel.classList.add("open");
}

function _runGenerate({ studentId, groupId, range }) {
  const sect = _panel?.querySelector(`#rdReportSect_${studentId}`);
  if (!sect) return;

  sect.innerHTML = `<span class="dd-sect-eye">Informe narrativo</span><p class="hint" style="margin:8px 0">Generando informe…</p>`;

  apiFetch("/api/v1/reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId, group_id: groupId, from: range.from, to: range.to }),
  }).then(res => res.json().catch(() => ({}))).then(body => {
    const text = body?.data?.narrative || "";
    if (!text) {
      sect.innerHTML = `<span class="dd-sect-eye">Informe narrativo</span><p class="hint" style="margin:8px 0;color:#ffb4a4">No se pudo generar el informe.</p>`;
      return;
    }
    sect.innerHTML = `
      <span class="dd-sect-eye">Informe narrativo</span>
      <div class="nbReportText">${_esc(text)}</div>
      <div class="dd-foot">
        <button class="dd-fbtn btn ghost nbBtn" type="button" id="rdCopyBtn_${_esc(studentId)}">Copiar</button>
      </div>
    `;
    sect.querySelector(`#rdCopyBtn_${studentId}`)?.addEventListener("click", () => {
      navigator.clipboard.writeText(text).catch(() => {});
    });
  }).catch(() => {
    sect.innerHTML = `<span class="dd-sect-eye">Informe narrativo</span><p class="hint" style="margin:8px 0;color:#ffb4a4">Error de conexión.</p>`;
  });
}
