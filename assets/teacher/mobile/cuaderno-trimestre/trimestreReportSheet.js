// trimestreReportSheet.js — Level 3 (stacked sheet): full trimester stats
// plus the AI-generated narrative report, with Copiar/Regenerar. Mirrors
// assets/teacher/js/features/report-drawer.js endpoint-for-endpoint.

import { fmtTime } from "../../js/session-drawer-render.js";
import { formatNota } from "./trimestreCalc.js";
import { mtFetchTrimesterReport, mtSaveTrimesterReport, mtGenerateTrimesterReport } from "./trimestreData.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

const SVG_X = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function _hwRow(hwDone, hwTotal) {
  if (!hwTotal) return "";
  const pct = Math.round((hwDone / hwTotal) * 100);
  return `
    <div class="mt-hw-row">
      <span class="mt-hw-label">Deberes entregados</span>
      <span class="mt-hw-ratio">${hwDone} / ${hwTotal}</span>
      <div class="mt-hw-track"><div class="mt-hw-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function _statsHtml({ notaMediaVal, stats, sessionStats, hwDone, hwTotal }) {
  const pct     = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const pctSolo = stats.total > 0 ? Math.min(100, Math.round((sessionStats.solvedAlone / stats.total) * 100)) : 0;
  return `
    <div class="mt-tsect-narrative">
      <span class="mt-tsect-label">Estadísticas del trimestre</span>
      <div class="mt-nota-global">
        <div class="mt-nota-num">${_esc(formatNota(notaMediaVal))}</div>
        <div class="mt-nota-lbl">Nota media global</div>
      </div>
      ${_hwRow(hwDone, hwTotal)}
      <div class="mt-rep-chips">
        <div class="mt-rep-chip"><em>Tareas hechas</em>${pct}%</div>
        <div class="mt-rep-chip"><em>Tiempo tutor</em>${_esc(fmtTime(sessionStats.totalSecs))}</div>
        <div class="mt-rep-chip"><em>Resolvió solo</em>${pctSolo}%</div>
      </div>
    </div>`;
}

function _showNarrative(sectEl, text, onRegenerate) {
  sectEl.innerHTML = `
    <span class="mt-tsect-label">Informe narrativo</span>
    <p class="mt-rep-text">${_esc(text)}</p>
    <div class="mt-rep-actions">
      <button class="mt-btn mt-btn--ghost" type="button" id="mtRepCopy">Copiar</button>
      <button class="mt-btn mt-btn--ghost" type="button" id="mtRepRegen">Regenerar informe</button>
    </div>`;
  sectEl.querySelector("#mtRepCopy").addEventListener("click", () => {
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  sectEl.querySelector("#mtRepRegen").addEventListener("click", onRegenerate);
}

async function _generate(sectEl, { apiFetch, studentId, groupId, trimester, subjectName, from, to }) {
  sectEl.innerHTML = `<span class="mt-tsect-label">Informe narrativo</span><p class="mt-loading-line">Generando informe…</p>`;
  const text = await mtGenerateTrimesterReport(apiFetch, { studentId, groupId, from, to });
  if (!text) {
    sectEl.innerHTML = `<span class="mt-tsect-label">Informe narrativo</span><p class="mt-loading-line mt-loading-line--err">No se pudo generar el informe.</p>`;
    return;
  }
  mtSaveTrimesterReport(apiFetch, { studentId, trimester, subjectName, narrative: text });
  _showNarrative(sectEl, text, () => _generate(sectEl, { apiFetch, studentId, groupId, trimester, subjectName, from, to }));
}

async function _loadOrGenerate(sectEl, params) {
  const existing = await mtFetchTrimesterReport(params.apiFetch, params);
  if (existing) {
    _showNarrative(sectEl, existing, () => _generate(sectEl, params));
    return;
  }
  await _generate(sectEl, params);
}

export function openTrimestreReportSheet({ sheetEl, backdropEl, contentEl, openSheet, closeSheet, apiFetch, studentName, studentId, groupId, trimester, subjectName, from, to, data }) {
  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <span class="mt-sheet-title">${_esc(studentName)}</span>
      <button class="mt-sheet-close" id="mtRepClose">${SVG_X}</button>
    </div>
    <div class="mt-sheet-body">
      ${_statsHtml(data)}
      <div class="mt-tsect-narrative" id="mtRepNarrative">
        <span class="mt-tsect-label">Informe narrativo</span>
        <p class="mt-loading-line">Cargando informe…</p>
      </div>
    </div>`;

  openSheet(sheetEl, backdropEl);
  const close = () => closeSheet(sheetEl, backdropEl);
  contentEl.querySelector("#mtRepClose").addEventListener("click", close);
  backdropEl.addEventListener("click", close, { once: true });

  _loadOrGenerate(contentEl.querySelector("#mtRepNarrative"), {
    apiFetch, studentId, groupId, trimester, subjectName, from, to,
  });
}
