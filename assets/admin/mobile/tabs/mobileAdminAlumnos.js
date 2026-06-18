// mobileAdminAlumnos.js — Tab Alumnos: three mini-stat cards (registrados /
// pendientes de aprobación / sin grupo) + "+ Invitar". Structure/classes
// match the reference design's AdminAlumnos exactly (.ministat-list).

import { fetchAllStudents, fetchGroups } from "../mobileAdminData.js";
import { openSheet, closeSheet } from "../mobileAdminSheets.js";
import { renderStudentInviteSheet } from "../students/mobileStudentInviteSheet.js";
import { renderPendingSheet } from "../students/mobilePendingSheet.js";
import { icon } from "../mobileAdminIcons.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export async function renderAdminAlumnos({ containerEl, sheetEl, backdropEl, fetchJSON, tenantName }) {
  function _draw({ usedCount, pendingApprovalCount, noGroupCount }) {
    const stats = [
      { id: null,             eye: "Registrados en el centro",  num: usedCount,            unit: usedCount === 1 ? "alumno" : "alumnos",  foot: "Con acceso activo",                                accent: true },
      { id: "adAPendingCard", eye: "Pendientes de aprobación",   num: pendingApprovalCount, unit: pendingApprovalCount === 1 ? "alumno" : "alumnos", foot: pendingApprovalCount > 0 ? "Requieren revisión" : "No hay solicitudes" },
      { id: null,             eye: "Sin grupo asignado",         num: noGroupCount,         unit: noGroupCount === 1 ? "alumno" : "alumnos", foot: noGroupCount > 0 ? "Revisar asignación" : "Todo correcto" },
    ];

    containerEl.innerHTML = `
      <div class="phead">
        <div class="phead-row">
          <div>
            <div class="phead-eyebrow">${_esc(tenantName || "")}</div>
            <h1 class="phead-title"><em>Alumnos</em></h1>
          </div>
          <button type="button" class="phead-pill" id="adAInviteBtn">${icon("plus", { size: 15, sw: 2.4 })} Invitar</button>
        </div>
        <div class="phead-meta"><span>${usedCount} registrado${usedCount !== 1 ? "s" : ""}</span><span class="sep"></span><span>${pendingApprovalCount} pendiente${pendingApprovalCount !== 1 ? "s" : ""}</span></div>
      </div>
      <div class="ministat-list">
        ${stats.map(s => `
          <div class="ministat ${s.accent ? "accent" : ""}"${s.id ? ` id="${s.id}"` : ""}>
            <div class="ministat-eye">${_esc(s.eye)}</div>
            <div class="ministat-row"><span class="ministat-num">${s.num}</span><span class="ministat-unit">${s.unit}</span></div>
            <div class="ministat-foot">${_esc(s.foot)}</div>
          </div>`).join("")}
      </div>`;

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

  containerEl.innerHTML = `<p class="dcard-empty">Cargando…</p>`;
  await _reload();
}
