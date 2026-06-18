// mobilePendingSheet.js — "Pendientes de aprobación" bottom sheet. Wraps
// the shared admin-student-approval.js module with its own elements — same
// approve/reject logic and endpoints as desktop, different DOM target.

import { initAdminStudentApproval } from "../../modules/admin-student-approval.js";
import { escHtml } from "../../modules/adminUtils.js";

export function renderPendingSheet({ contentEl, fetchJSON, onClose }) {
  contentEl.innerHTML = `
    <div class="ad-sheet-header">
      <span class="ad-sheet-title">Pendientes de aprobación</span>
      <button class="ad-sheet-close" id="adPdClose">×</button>
    </div>
    <div class="ad-sheet-body">
      <p class="ad-loading-line ad-loading-line--err" id="adPdError"></p>
      <div id="adPdList"><p class="ad-loading">Cargando…</p></div>
    </div>`;

  contentEl.querySelector("#adPdClose").addEventListener("click", onClose);

  const approval = initAdminStudentApproval({
    fetchJSON,
    escHtml,
    listEl:  contentEl.querySelector("#adPdList"),
    errorEl: contentEl.querySelector("#adPdError"),
  });

  approval.load();
}
