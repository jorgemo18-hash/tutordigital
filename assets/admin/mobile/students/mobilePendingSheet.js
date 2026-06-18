// mobilePendingSheet.js — "Pendientes de aprobación" bottom sheet. Wraps
// the shared admin-student-approval.js module with its own elements — same
// approve/reject logic and endpoints as desktop, different DOM target.

import { initAdminStudentApproval } from "../../modules/admin-student-approval.js";
import { escHtml } from "../../modules/adminUtils.js";
import { icon } from "../mobileAdminIcons.js";

export function renderPendingSheet({ contentEl, fetchJSON, onClose }) {
  contentEl.innerHTML = `
    <div class="sheet-head">
      <div class="sheet-title">Pendientes de <em>aprobación</em></div>
      <button type="button" class="iconbtn" id="adPdClose" aria-label="Cerrar">${icon("close", { size: 20 })}</button>
    </div>
    <div class="sheet-body">
      <p class="sheet-error" id="adPdError"></p>
      <div id="adPdList"><p class="dcard-empty">Cargando…</p></div>
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
