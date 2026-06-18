// mobileTeacherInviteSheet.js — "Invitar profesor" bottom sheet. Reuses
// desktop's adminTeacherEntryBlock.js (renderAssignBlock/buildPayload) for
// the group+subject picker — same markup, same event-delegation contract,
// same payload shape sent to POST /api/v1/admin/teachers/invite.

import { renderAssignBlock, buildPayload, STAGE_LABEL } from "../../modules/adminTeacherEntryBlock.js";
import { inviteTeacher } from "../mobileAdminData.js";
import { uniq } from "../../modules/adminUtils.js";
import { icon } from "../mobileAdminIcons.js";

const DEFAULT_SUBJECTS = [
  "Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología",
  "Historia", "Geografía", "Filosofía", "Economía", "Tecnología",
  "Música", "Educación Física", "Plástica", "Francés",
];

export function renderTeacherInviteSheet({ contentEl, fetchJSON, allGroups, existingTeachers, onClose, onInvited }) {
  let entries         = [];
  let expandedGroupId = null;
  let pickerStep       = 0;
  let pickerCourse      = null;
  let pickerTrackSet    = new Set();

  function subjectCatalog() {
    const fromTeachers = (existingTeachers || []).flatMap(t => t.subjects || []);
    return uniq([...DEFAULT_SUBJECTS, ...fromTeachers]).sort((a, b) => a.localeCompare(b, "es"));
  }

  function draw() {
    contentEl.innerHTML = `
      <div class="sheet-head">
        <div class="sheet-title">Invitar <em>profesor</em></div>
        <button type="button" class="iconbtn" id="adTiClose" aria-label="Cerrar">${icon("close", { size: 20 })}</button>
      </div>
      <div class="sheet-body">
        <div class="dcard-sub" style="margin-top:-4px">Configura grupos y asignaturas — el docente no tendrá que hacer nada al entrar.</div>
        <div>
          <label class="field-label">Email <span style="color:var(--copper-soft)">*</span></label>
          <input class="sheet-input" id="adTiEmail" type="email" placeholder="docente@centro.com" autocomplete="email">
        </div>
        <div>
          <label class="field-label">Nombre <span style="color:var(--ink-faint)">· opcional</span></label>
          <input class="sheet-input" id="adTiName" type="text" placeholder="Nombre completo">
        </div>
        <div>
          <label class="field-label">Grupos y asignaturas</label>
          <div id="adTiAssignBlock"></div>
        </div>
        <p class="sheet-error" id="adTiError" style="display:none"></p>
      </div>
      <div class="sheet-foot">
        <button type="button" class="btn btn-ghost" id="adTiCancel">Cancelar</button>
        <button type="button" class="btn btn-primary" id="adTiSend" disabled>${icon("send", { size: 16 })} Enviar invitación</button>
      </div>`;

    const assignBlock = contentEl.querySelector("#adTiAssignBlock");
    const addedIds  = new Set(entries.map(e => e.groupId));
    renderAssignBlock(assignBlock, {
      entries,
      availableGroups: (allGroups || []).filter(g => !addedIds.has(g.id)),
      subjects: subjectCatalog(),
      expandedGroupId, pickerStep, pickerCourse, pickerTrackSet,
      showIsTutor: true,
    });

    contentEl.querySelector("#adTiClose").addEventListener("click", onClose);
    contentEl.querySelector("#adTiCancel").addEventListener("click", onClose);
    contentEl.querySelector("#adTiEmail").addEventListener("input", _refreshSendBtn);
    contentEl.querySelector("#adTiSend").addEventListener("click", () => _submit().catch(console.error));

    assignBlock.addEventListener("click", _handleAssignClick);
    assignBlock.addEventListener("change", ev => {
      const toggle = ev.target.closest("[data-ab-is-tutor]");
      if (!toggle) return;
      const entry = entries.find(e => e.groupId === toggle.dataset.abIsTutor);
      if (entry) entry.isTutor = toggle.checked;
    });

    _refreshSendBtn();
  }

  function _refreshSendBtn() {
    const email = contentEl.querySelector("#adTiEmail")?.value.trim() || "";
    const sendBtn = contentEl.querySelector("#adTiSend");
    if (sendBtn) sendBtn.disabled = !(email.includes("@") && entries.length > 0);
  }

  function _groupLetter(g) {
    const s = String(g.stage || "").toLowerCase();
    return s.includes("bach") ? "B" : s.includes("eso") ? "E" : s.includes("prim") ? "P" : (g.name || "?")[0].toUpperCase();
  }
  function _groupMeta(g) {
    return [STAGE_LABEL[g.stage] || g.stage, g.year ? `${g.year}º` : ""].filter(Boolean).join(" · ");
  }

  function _handleAssignClick(ev) {
    const removeBtn = ev.target.closest("[data-ab-remove]");
    if (removeBtn) { entries = entries.filter(e => e.groupId !== removeBtn.dataset.abRemove); draw(); return; }

    const expandEl = ev.target.closest("[data-ab-expand]");
    if (expandEl) { const id = expandEl.dataset.abExpand; expandedGroupId = expandedGroupId === id ? null : id; draw(); return; }

    const subjectChip = ev.target.closest("[data-ab-subject]");
    if (subjectChip) {
      const entry = entries.find(e => e.groupId === subjectChip.dataset.abGroup);
      if (entry) {
        const s = subjectChip.dataset.abSubject;
        if (entry.selectedSubjects.has(s)) entry.selectedSubjects.delete(s); else entry.selectedSubjects.add(s);
      }
      draw();
      return;
    }
    if (ev.target.closest("[data-ab-open-picker]")) { pickerStep = 1; draw(); return; }

    const courseChip = ev.target.closest("[data-ab-pick-course]");
    if (courseChip) {
      const [stage, yearStr] = courseChip.dataset.abPickCourse.split("|");
      pickerCourse   = { stage, year: Number(yearStr), label: `${STAGE_LABEL[stage] || stage} ${Number(yearStr)}º` };
      pickerTrackSet = new Set();
      pickerStep     = 2;
      draw();
      return;
    }
    const trackChip = ev.target.closest("[data-ab-pick-track]");
    if (trackChip) {
      const id = trackChip.dataset.abPickTrack;
      if (pickerTrackSet.has(id)) pickerTrackSet.delete(id); else pickerTrackSet.add(id);
      draw();
      return;
    }
    if (ev.target.closest("[data-ab-confirm-tracks]")) {
      const addedIds  = new Set(entries.map(e => e.groupId));
      const available = (allGroups || []).filter(g => !addedIds.has(g.id));
      for (const id of pickerTrackSet) {
        const g = available.find(x => x.id === id);
        if (g) entries.push({ groupId: g.id, groupName: g.name || g.id, groupLetter: _groupLetter(g), groupMeta: _groupMeta(g), selectedSubjects: new Set(), isTutor: false });
      }
      pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set();
      draw();
      return;
    }
    if (ev.target.closest("[data-ab-back-step1]"))   { pickerStep = 1; pickerCourse = null; pickerTrackSet = new Set(); draw(); return; }
    if (ev.target.closest("[data-ab-cancel-picker]")) { pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set(); draw(); return; }
  }

  async function _submit() {
    const email = contentEl.querySelector("#adTiEmail").value.trim().toLowerCase();
    const display_name = contentEl.querySelector("#adTiName").value.trim() || email.split("@")[0];
    const errEl = contentEl.querySelector("#adTiError");
    const sendBtn = contentEl.querySelector("#adTiSend");
    if (!email.includes("@") || !entries.length) return;

    sendBtn.disabled = true;
    sendBtn.innerHTML = "Enviando…";
    errEl.style.display = "none";
    try {
      const { assignments, group_ids, tutor_group_ids } = buildPayload(entries);
      const tutor_group_id = tutor_group_ids[0] || null;
      await inviteTeacher(fetchJSON, { email, display_name, assignments, group_ids, tutor_group_id });
      onInvited();
    } catch (err) {
      errEl.textContent = err?.message || "No se pudo enviar la invitación.";
      errEl.style.display = "block";
      sendBtn.disabled = false;
      sendBtn.innerHTML = `${icon("send", { size: 16 })} Enviar invitación`;
    }
  }

  draw();
}
