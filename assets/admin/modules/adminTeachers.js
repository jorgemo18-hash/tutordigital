import { normalizeLabel, uniq, copyToClipboard, fetchJSON, toItems } from "./adminUtils.js";
import {
  groupLetter, groupMeta, coursesFromGroups,
  renderAssignBlock, STAGE_KEYS, STAGE_LABEL,
} from "./adminTeacherEntryBlock.js";
import { renderTeacherList } from "./adminTeacherList.js";

const DEFAULT_SUBJECTS = [
  "Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología",
  "Historia", "Geografía", "Filosofía", "Economía", "Tecnología",
  "Música", "Educación Física", "Plástica", "Francés",
];

export function initTeacherSection({ state, groupsEls, setError }) {

  const pendingInviteUrls = new Map();
  const expandedTeachers  = new Set();

  // [{groupId, groupName, groupLetter, groupMeta, selectedSubjects: Set, isTutor: false}]
  let groupEntries    = [];
  let expandedGroupId = null;
  let pickerStep      = 0;
  let pickerCourse    = null;
  let pickerTrackSet  = new Set();
  let tutorGroupId    = null;

  const getGroups = () => state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);

  const inviteNoticeEl     = document.getElementById("inviteNotice");
  const teacherEmail       = document.getElementById("teacherEmail");
  const teacherDisplayName = document.getElementById("teacherDisplayName");
  const assignBlock        = document.getElementById("assignBlock");
  const sendInviteBtn      = document.getElementById("sendInviteBtn");
  const inviteFormPanel    = document.getElementById("inviteFormPanel");
  const showInviteFormBtn  = document.getElementById("showInviteFormBtn");
  const teachersList       = document.getElementById("teachersList");

  // ── Notice ────────────────────────────────────────────────────────────────

  let _noticeClearTimer = null;
  function showNotice(msg) {
    if (!inviteNoticeEl) return;
    inviteNoticeEl.textContent = msg;
    inviteNoticeEl.classList.remove("hidden");
    if (_noticeClearTimer) clearTimeout(_noticeClearTimer);
    _noticeClearTimer = setTimeout(() => inviteNoticeEl?.classList.add("hidden"), 6000);
  }

  // ── Assign block ──────────────────────────────────────────────────────────

  function subjectCatalog() {
    const fromTeachers = (state.teachers || []).flatMap(t => t.subjects || []);
    return uniq([...DEFAULT_SUBJECTS, ...fromTeachers]).sort((a, b) => a.localeCompare(b, "es"));
  }

  function rebuildBlock() {
    if (!assignBlock) return;
    const addedIds  = new Set(groupEntries.map(e => e.groupId));
    const available = getGroups().filter(g => !addedIds.has(g.id));
    renderAssignBlock(assignBlock, {
      entries:         groupEntries,
      availableGroups: available,
      subjects:        subjectCatalog(),
      expandedGroupId,
      pickerStep,
      pickerCourse,
      pickerTrackSet,
      showTutorSection: true,
      tutorGroupId,
    });
  }

  function buildAssignments() {
    const map = new Map();
    for (const entry of groupEntries) {
      for (const subject of entry.selectedSubjects) {
        const set = map.get(subject) || new Set();
        set.add(entry.groupId);
        map.set(subject, set);
      }
    }
    return [...map.entries()].map(([subject, groupIds]) => ({ subject, group_ids: [...groupIds] }));
  }

  // ── Form controls ─────────────────────────────────────────────────────────

  function refreshInviteButtons() {
    if (!sendInviteBtn) return;
    const hasEmail      = Boolean(normalizeLabel(teacherEmail?.value));
    const hasGroups     = groupEntries.length > 0;
    const hasAnySubject = groupEntries.some(e => e.selectedSubjects.size > 0);
    sendInviteBtn.disabled = !(hasEmail && hasGroups && hasAnySubject);
  }

  function closeInvitePanel() {
    inviteFormPanel?.classList.add("hidden");
    if (showInviteFormBtn) showInviteFormBtn.textContent = "+ Invitar docente";
    resetInviteForm();
  }

  function resetInviteForm() {
    if (teacherEmail)       teacherEmail.value = "";
    if (teacherDisplayName) teacherDisplayName.value = "";
    groupEntries    = [];
    expandedGroupId = null;
    pickerStep      = 0;
    pickerCourse    = null;
    pickerTrackSet  = new Set();
    tutorGroupId    = null;
    rebuildBlock();
    refreshInviteButtons();
  }

  // ── Invite actions ────────────────────────────────────────────────────────

  async function createInvite() {
    setError("");
    const email       = normalizeLabel(teacherEmail?.value);
    const displayName = normalizeLabel(teacherDisplayName?.value) || null;
    const assignments = buildAssignments();

    if (!email)               return setError("Introduce el email del docente.");
    if (!groupEntries.length) return setError("Añade al menos un grupo.");
    if (!assignments.length)  return setError("Selecciona al menos una asignatura en algún grupo.");

    const data = await fetchJSON("/api/v1/admin/teachers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        display_name:   displayName || email.split("@")[0],
        assignments,
        tutor_group_id: tutorGroupId || null,
      }),
    });

    const invite    = data?.invite || {};
    const emailSent = data?.email_sent !== false;
    if (invite.invite_url) pendingInviteUrls.set(email, invite.invite_url);

    const allGroupsFull = getGroups();
    const optimisticTeacher = {
      email,
      display_name: displayName || email.split("@")[0],
      subjects: uniq(assignments.map(a => a.subject)),
      groups: uniq(assignments.flatMap(a => a.group_ids)).map(id => ({
        id,
        name:     allGroupsFull.find(g => g.id === id)?.name || id,
        is_tutor: id === tutorGroupId,
        subjects: assignments.filter(a => a.group_ids.includes(id)).map(a => a.subject),
      })),
      invite: { status: "pending", id: invite.id || null },
    };
    state.teachers = [optimisticTeacher, ...(state.teachers || []).filter(t => t.email !== email)];
    renderTeachers();
    closeInvitePanel();
    showNotice(emailSent
      ? `Invitación enviada a ${email}`
      : `Invitación creada para ${email} (email no enviado — usa "Copiar enlace")`
    );
    reloadTeachers().catch(console.error);
  }

  async function revokeInvite(inviteId) {
    setError("");
    await fetchJSON(`/api/v1/admin/teachers/teacher-invites/${inviteId}/revoke`, { method: "POST" });
    await reloadTeachers();
  }

  // ── Teachers list ─────────────────────────────────────────────────────────

  function renderTeachers() {
    renderTeacherList({ container: teachersList, teachers: state.teachers, expandedTeachers, pendingInviteUrls });
  }

  async function reloadTeachers() {
    const res = await fetchJSON("/api/v1/admin/teachers");
    state.teachers = toItems(res, "teachers");
    state.teachersLoaded = true;
    renderTeachers();
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents() {
    showInviteFormBtn?.addEventListener("click", () => {
      const isOpen = !inviteFormPanel?.classList.contains("hidden");
      if (isOpen) {
        closeInvitePanel();
      } else {
        inviteFormPanel?.classList.remove("hidden");
        if (showInviteFormBtn) showInviteFormBtn.textContent = "× Cancelar";
        rebuildBlock();
        refreshInviteButtons();
      }
    });

    document.getElementById("closeInviteFormBtn")?.addEventListener("click", closeInvitePanel);
    document.getElementById("cancelInviteBtn")?.addEventListener("click", closeInvitePanel);
    sendInviteBtn?.addEventListener("click", () => {
      createInvite().catch(err => setError(err?.message || "No se pudo crear la invitación."));
    });
    teacherEmail?.addEventListener("input", refreshInviteButtons);
    teacherDisplayName?.addEventListener("input", refreshInviteButtons);

    // Assign block delegation (data-ab-* attributes from adminTeacherEntryBlock)
    assignBlock?.addEventListener("click", ev => {
      const removeBtn = ev.target.closest("[data-ab-remove]");
      if (removeBtn) {
        const id = removeBtn.dataset.abRemove;
        groupEntries = groupEntries.filter(e => e.groupId !== id);
        if (tutorGroupId === id) tutorGroupId = null;
        if (expandedGroupId === id) expandedGroupId = null;
        rebuildBlock();
        refreshInviteButtons();
        return;
      }
      const expandEl = ev.target.closest("[data-ab-expand]");
      if (expandEl) {
        const id = expandEl.dataset.abExpand;
        expandedGroupId = expandedGroupId === id ? null : id;
        rebuildBlock();
        return;
      }
      const subjectChip = ev.target.closest("[data-ab-subject]");
      if (subjectChip) {
        const entry = groupEntries.find(e => e.groupId === subjectChip.dataset.abGroup);
        if (entry) {
          const s = subjectChip.dataset.abSubject;
          if (entry.selectedSubjects.has(s)) entry.selectedSubjects.delete(s);
          else entry.selectedSubjects.add(s);
          subjectChip.classList.toggle("active", entry.selectedSubjects.has(s));
          const countEl = assignBlock.querySelector(`[data-ab-subject-count="${entry.groupId}"]`);
          if (countEl) {
            const n = entry.selectedSubjects.size;
            countEl.textContent = n === 0 ? "Ninguna seleccionada" : n === 1 ? "1 seleccionada" : `${n} seleccionadas`;
          }
        }
        refreshInviteButtons();
        return;
      }
      const tutorChip = ev.target.closest("[data-ab-tutor-chip]");
      if (tutorChip) {
        const id = tutorChip.dataset.abTutorChip;
        tutorGroupId = tutorGroupId === id ? null : id;
        rebuildBlock();
        return;
      }
      if (ev.target.closest("[data-ab-open-picker]")) { pickerStep = 1; rebuildBlock(); return; }
      const courseChip = ev.target.closest("[data-ab-pick-course]");
      if (courseChip) {
        const [stage, yearStr] = courseChip.dataset.abPickCourse.split("|");
        pickerCourse   = { stage, year: Number(yearStr), label: `${STAGE_LABEL[stage] || stage} ${Number(yearStr)}º` };
        pickerTrackSet = new Set();
        pickerStep     = 2;
        rebuildBlock();
        return;
      }
      const trackChip = ev.target.closest("[data-ab-pick-track]");
      if (trackChip) {
        const id = trackChip.dataset.abPickTrack;
        if (pickerTrackSet.has(id)) pickerTrackSet.delete(id); else pickerTrackSet.add(id);
        rebuildBlock();
        return;
      }
      if (ev.target.closest("[data-ab-confirm-tracks]")) {
        const addedIds  = new Set(groupEntries.map(e => e.groupId));
        const available = getGroups().filter(g => !addedIds.has(g.id));
        let firstNew = null;
        for (const id of pickerTrackSet) {
          const g = available.find(x => x.id === id);
          if (g) {
            groupEntries.push({
              groupId: g.id, groupName: g.name || g.id,
              groupLetter: groupLetter(g), groupMeta: groupMeta(g),
              selectedSubjects: new Set(), isTutor: false,
            });
            firstNew = firstNew || g.id;
          }
        }
        pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set();
        expandedGroupId = firstNew;
        rebuildBlock();
        refreshInviteButtons();
        return;
      }
      if (ev.target.closest("[data-ab-back-step1]"))    { pickerStep = 1; pickerCourse = null; pickerTrackSet = new Set(); rebuildBlock(); return; }
      if (ev.target.closest("[data-ab-cancel-picker]")) { pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set(); rebuildBlock(); return; }
    });

    // Teachers list: expand/collapse, revoke, copy
    teachersList?.addEventListener("click", ev => {
      const revokeBtn = ev.target.closest("button[data-revoke-id]");
      if (revokeBtn) {
        revokeInvite(revokeBtn.dataset.revokeId).catch(err => setError(err?.message || "No se pudo revocar."));
        return;
      }
      const copyBtn = ev.target.closest("button[data-copy-invite-email]");
      if (copyBtn) {
        const url = pendingInviteUrls.get(copyBtn.dataset.copyInviteEmail);
        if (url) {
          copyToClipboard(url, null).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "✓ Copiado";
            setTimeout(() => { copyBtn.textContent = orig; }, 2000);
          });
        }
        return;
      }
      const verGruposBtn = ev.target.closest("button[data-ver-grupos]");
      if (verGruposBtn) {
        const key = verGruposBtn.dataset.verGrupos;
        if (!key) return;
        if (expandedTeachers.has(key)) expandedTeachers.delete(key);
        else expandedTeachers.add(key);
        renderTeachers();
        return;
      }
    });
  }

  return {
    reloadTeachers,
    refreshInviteButtons,
    wireEvents,
    closeInvitePanel,
    renderInviteSummary: () => {},
    renderGroupPicker:   () => {},
    renderAssignmentSubjectSelect: () => {},
    showInviteStep: () => {},
  };
}
