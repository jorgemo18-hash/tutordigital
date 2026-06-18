// mobileAdminAlumnos.js — Tab Alumnos: three tappable summary cards
// (registrados / pendientes de aprobación / sin grupo) + "+ Invitar".

import { fetchAllStudents, fetchGroups } from "../mobileAdminData.js";
import { openSheet, closeSheet } from "../mobileAdminSheets.js";
import { renderStudentInviteSheet } from "../students/mobileStudentInviteSheet.js";
import { renderPendingSheet } from "../students/mobilePendingSheet.js";

export async function renderAdminAlumnos({ containerEl, sheetEl, backdropEl, fetchJSON, tenantName }) {
  function _draw({ usedCount, pendingApprovalCount, noGroupCount }) {
    containerEl.innerHTML = `
      <div class="ad-tab-header">
        <span class="ad-tab-eyebrow">${_esc(tenantName || "")}</span>
        <h1 class="ad-tab-title">Alumnos</h1>
        <span class="ad-tab-count">${usedCount} registrado${usedCount !== 1 ? "s" : ""} · ${pendingApprovalCount} pendiente${pendingApprovalCount !== 1 ? "s" : ""}</span>
        <button class="ad-btn ad-btn--primary" type="button" id="adAInviteBtn">+ Invitar alumno</button>
      </div>
      <button type="button" class="ad-summary-card">
        <span class="ad-summary-num">${usedCount}</span>
        <span class="ad-summary-label">Registrados en el centro</span>
        <span class="ad-summary-foot">Con acceso activo</span>
      </button>
      <button type="button" class="ad-summary-card" id="adAPendingCard">
        <span class="ad-summary-num">${pendingApprovalCount}</span>
        <span class="ad-summary-label">Pendientes de aprobación</span>
        <span class="ad-summary-foot">${pendingApprovalCount > 0 ? "Requieren revisión" : "Sin pendientes"}</span>
      </button>
      <button type="button" class="ad-summary-card">
        <span class="ad-summary-num">${noGroupCount}</span>
        <span class="ad-summary-label">Sin grupo asignado</span>
      </button>`;

    containerEl.querySelector("#adAInviteBtn").addEventListener("click", () => _openInviteSheet());
    containerEl.querySelector("#adAPendingCard").addEventListener("click", () => _openPendingSheet());
  }

  function _openPendingSheet() {
    const contentEl = sheetEl.querySelector("#adSheetContent");
    renderPendingSheet({ contentEl, fetchJSON, onClose: () => { closeSheet(sheetEl, backdropEl); _reload(); } });
    openSheet(sheetEl, backdropEl);
  }

  async function _openInviteSheet() {
    const groupsData = await fetchGroups(fetchJSON).catch(() => ({ items: [] }));
    const contentEl = sheetEl.querySelector("#adSheetContent");
    renderStudentInviteSheet({
      contentEl, fetchJSON, allGroups: groupsData?.items || [],
      onClose: () => closeSheet(sheetEl, backdropEl),
      onInvited: async () => { closeSheet(sheetEl, backdropEl); await _reload(); },
    });
    openSheet(sheetEl, backdropEl);
  }

  async function _reload() {
    const data = await fetchAllStudents(fetchJSON).catch(() => ({ items: [] }));
    const items = data?.items || [];
    const usedCount  = items.filter(s => s.status === "used").length;
    const noGroupCount = items.filter(s => !s.group_id).length;
    const pendingData = await fetchJSON("/api/v1/admin/students/pending").catch(() => ({ items: [] }));
    const pendingApprovalCount = (pendingData?.items || []).length;
    _draw({ usedCount, pendingApprovalCount, noGroupCount });
  }

  containerEl.innerHTML = `<p class="ad-loading">Cargando…</p>`;
  await _reload();
}

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
