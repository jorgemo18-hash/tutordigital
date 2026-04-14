import { escHtml, normalizeLabel, uniq, renderChips, copyToClipboard, fetchJSON, toItems } from "./adminUtils.js";

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SUBJECTS = [
  "Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología",
  "Historia", "Geografía", "Filosofía", "Economía", "Tecnología",
  "Música", "Educación Física", "Plástica", "Francés",
];

const SUBJECT_PLACEHOLDER = "__placeholder__";
const SUBJECT_OTHER = "__OTHER__";

// ── Init ───────────────────────────────────────────────────────────────────

export function initTeacherSection({ state, groupsEls, setError }) {
  // ── Assignments state ────────────────────────────────────────────────────
  let assignments = []; // [{subject, group_ids, groupLabels}]
  let pendingGroupIds = new Set();
  let inviteBtnMode = "create";

  // DOM refs
  const resultEl              = document.getElementById("adminInviteResult");
  const inviteResultEl        = document.getElementById("inviteResult");
  const inviteEmailValueEl    = document.getElementById("inviteEmailValue");
  const clearInviteResultBtn  = document.getElementById("clearInviteResultBtn");
  const teacherEmail          = document.getElementById("teacherEmail");
  const teacherDisplayName    = document.getElementById("teacherDisplayName");
  const summarySubjectChips   = document.getElementById("summarySubjectChips");
  const summaryGroupChips     = document.getElementById("summaryGroupChips");
  const summaryTutorChip      = document.getElementById("summaryTutorChip");
  const teachersList          = document.getElementById("teachersList");
  const createTeacherInviteBtn = document.getElementById("createTeacherInviteBtn");
  const inviteStartBtn        = document.getElementById("inviteStartBtn");
  const toTutorBtn            = document.getElementById("toTutorBtn");
  const inviteStepBasics      = document.getElementById("inviteStepBasics");
  const inviteStepAssignments = document.getElementById("inviteStepAssignments");
  const inviteStepTutor       = document.getElementById("inviteStepTutor");
  // Assignment-step elements
  const assignmentSubjectSelect    = document.getElementById("assignmentSubjectSelect");
  const assignmentSubjectAddWrap   = document.getElementById("assignmentSubjectAddWrap");
  const assignmentSubjectInput     = document.getElementById("assignmentSubjectInput");
  const assignmentSubjectAddBtn    = document.getElementById("assignmentSubjectAddBtn");
  const assignmentGroupSelect      = document.getElementById("assignmentGroupSelect");
  const assignmentPendingGroupChips = document.getElementById("assignmentPendingGroupChips");
  const addAssignmentBtn           = document.getElementById("addAssignmentBtn");
  const assignmentsList            = document.getElementById("assignmentsList");
  const assignmentsError           = document.getElementById("assignmentsError");

  // ── Wizard steps ──────────────────────────────────────────────────────────

  function showInviteStep(stepName = "basics") {
    const map = { basics: inviteStepBasics, assignments: inviteStepAssignments, tutor: inviteStepTutor };
    Object.entries(map).forEach(([key, el]) => el?.classList.toggle("hidden", key !== stepName));
    if (stepName === "assignments") { renderAssignmentSubjectSelect(); renderAssignmentGroupSelect(); }
    if (stepName === "tutor") renderTutorOptionsFromAssignments();
    refreshInviteButtons();
  }

  function setResult(msg) {
    if (!resultEl) return;
    if (!msg) { resultEl.textContent = ""; resultEl.classList.add("hidden"); return; }
    resultEl.textContent = msg;
    resultEl.classList.remove("hidden");
  }

  function showInviteResult({ email, inviteUrl, emailSent = true }) {
    if (!inviteResultEl) return;
    if (inviteEmailValueEl) {
      const subtitle = emailSent
        ? `<div style="margin-top:8px;opacity:0.9">Supabase ha enviado un email de invitación. También puedes copiar el enlace y enviarlo manualmente.</div>`
        : `<div style="margin-top:8px;color:#c9723a;font-weight:600">⚠️ No se pudo enviar el email. Copia este enlace y envíaselo al docente manualmente.</div>`;
      inviteEmailValueEl.innerHTML = `<div>Invitación para: <strong>${escHtml(email)}</strong></div>${subtitle}`;
    }
    const linkBox   = document.getElementById("inviteLinkBox");
    const linkInput = document.getElementById("inviteLinkInput");
    if (linkBox && linkInput && inviteUrl) { linkInput.value = inviteUrl; linkBox.hidden = false; }
    else if (linkBox) linkBox.hidden = true;
    inviteResultEl.hidden = false;
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  function renderInviteSummary() {
    if (summarySubjectChips) {
      summarySubjectChips.innerHTML = assignments.length
        ? assignments.map(a => `<span class="chip">${escHtml(a.subject)} → ${a.groupLabels.map(escHtml).join(", ")}</span>`).join("")
        : "";
    }
    // Groups row is redundant — groups are embedded in assignments
    if (summaryGroupChips) {
      const row = summaryGroupChips.closest(".inviteSummaryRow");
      if (row) row.hidden = true;
    }
    const tutorId = normalizeLabel(groupsEls.tutorGroupSelect?.value);
    const tutorLabel = tutorId ? (state.allGroups || []).find(g => g.id === tutorId)?.name || tutorId : null;
    const tutorItems = tutorLabel ? [{ key: tutorId, label: tutorLabel }] : [];
    renderChips(summaryTutorChip, tutorItems, () => {
      if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
      renderInviteSummary();
      refreshInviteButtons();
    });
  }

  function refreshInviteButtons() {
    const hasBasics = Boolean(normalizeLabel(teacherEmail?.value) && normalizeLabel(teacherDisplayName?.value));
    if (inviteStartBtn)         inviteStartBtn.disabled = !hasBasics;
    if (toTutorBtn)             toTutorBtn.disabled = !assignments.length;
    if (createTeacherInviteBtn) createTeacherInviteBtn.disabled = !(hasBasics && assignments.length);
  }

  // ── Assignment subject select ─────────────────────────────────────────────

  function renderAssignmentSubjectSelect() {
    if (!assignmentSubjectSelect) return;
    const fromTeachers = (state.teachers || []).flatMap(t => t.subjects || []);
    const catalog = uniq([...DEFAULT_SUBJECTS, ...state.customSubjects, ...fromTeachers])
      .sort((a, b) => a.localeCompare(b, "es"));
    assignmentSubjectSelect.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = SUBJECT_PLACEHOLDER; ph.textContent = "Selecciona materia…"; ph.selected = true; ph.disabled = true;
    assignmentSubjectSelect.appendChild(ph);
    catalog.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = s;
      assignmentSubjectSelect.appendChild(opt);
    });
    const other = document.createElement("option");
    other.value = SUBJECT_OTHER; other.textContent = "Otro…";
    assignmentSubjectSelect.appendChild(other);
    assignmentSubjectSelect.value = SUBJECT_PLACEHOLDER;
    refreshAssignmentSubjectAddVisibility();
  }

  function refreshAssignmentSubjectAddVisibility() {
    if (!assignmentSubjectAddWrap || !assignmentSubjectSelect) return;
    const show = assignmentSubjectSelect.value === SUBJECT_OTHER;
    assignmentSubjectAddWrap.classList.toggle("hidden", !show);
    if (!show && assignmentSubjectInput) assignmentSubjectInput.value = "";
  }

  function addAssignmentCustomSubject() {
    const value = normalizeLabel(assignmentSubjectInput?.value);
    if (!value) return;
    state.customSubjects = uniq([...state.customSubjects, value]);
    renderAssignmentSubjectSelect();
    if (assignmentSubjectSelect) assignmentSubjectSelect.value = value;
    refreshAssignmentSubjectAddVisibility();
    assignmentSubjectInput?.focus();
  }

  // ── Assignment group select ────────────────────────────────────────────────

  function renderAssignmentGroupSelect() {
    if (!assignmentGroupSelect) return;
    const groups = (state.allGroups || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    assignmentGroupSelect.innerHTML = '<option value="">Grupo…</option>';
    groups.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name || g.id;
      assignmentGroupSelect.appendChild(opt);
    });
  }

  function renderPendingGroupChips() {
    if (!assignmentPendingGroupChips) return;
    const ids = [...pendingGroupIds];
    if (!ids.length) {
      assignmentPendingGroupChips.classList.add("hidden");
      assignmentPendingGroupChips.innerHTML = "";
      return;
    }
    const groups = state.allGroups || [];
    assignmentPendingGroupChips.classList.remove("hidden");
    assignmentPendingGroupChips.innerHTML = ids.map(id => {
      const name = groups.find(g => g.id === id)?.name || id;
      return `<span class="chip">${escHtml(name)}<button class="chipRemove" data-remove-pending="${id}" type="button" aria-label="Quitar">×</button></span>`;
    }).join("");
  }

  // ── Assignments management ────────────────────────────────────────────────

  function renderAssignmentsList() {
    if (!assignmentsList) return;
    if (!assignments.length) { assignmentsList.innerHTML = ""; return; }
    assignmentsList.innerHTML = `<div class="assignmentsListInner">${
      assignments.map((a, i) => `
        <div class="assignmentRow">
          <span class="assignmentSubject">${escHtml(a.subject)}</span>
          <span class="assignmentArrow">→</span>
          <span class="assignmentGroups">${a.groupLabels.map(escHtml).join(", ")}</span>
          <button class="btn ghost small" data-remove-assignment="${i}" type="button" aria-label="Eliminar asignación">×</button>
        </div>`).join("")
    }</div>`;
  }

  function addAssignment() {
    const subject = assignmentSubjectSelect?.value;
    if (!subject || subject === SUBJECT_PLACEHOLDER || subject === SUBJECT_OTHER) {
      if (assignmentsError) assignmentsError.textContent = "Selecciona una materia.";
      return;
    }
    if (!pendingGroupIds.size) {
      if (assignmentsError) assignmentsError.textContent = "Selecciona al menos un grupo.";
      return;
    }
    if (assignmentsError) assignmentsError.textContent = "";

    const groups = state.allGroups || [];
    const newGroupIds = [...pendingGroupIds];
    const existing = assignments.find(a => a.subject === subject);
    if (existing) {
      for (const id of newGroupIds) {
        if (!existing.group_ids.includes(id)) {
          existing.group_ids.push(id);
          existing.groupLabels.push(groups.find(g => g.id === id)?.name || id);
        }
      }
    } else {
      assignments.push({
        subject,
        group_ids: newGroupIds,
        groupLabels: newGroupIds.map(id => groups.find(g => g.id === id)?.name || id),
      });
    }

    pendingGroupIds.clear();
    renderPendingGroupChips();
    renderAssignmentsList();
    renderInviteSummary();
    refreshInviteButtons();
    if (assignmentSubjectSelect) assignmentSubjectSelect.value = SUBJECT_PLACEHOLDER;
    refreshAssignmentSubjectAddVisibility();
  }

  // ── Tutor ─────────────────────────────────────────────────────────────────

  function renderTutorOptionsFromAssignments() {
    const sel = groupsEls.tutorGroupSelect;
    if (!sel) return;
    const allIds = new Set(assignments.flatMap(a => a.group_ids));
    const eligible = (state.allGroups || [])
      .filter(g => allIds.has(g.id))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    sel.innerHTML = '<option value="">Sin tutoría</option>';
    eligible.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id; opt.textContent = g.name;
      sel.appendChild(opt);
    });
  }

  // ── Teachers list ─────────────────────────────────────────────────────────

  function inviteStatusLabel(status = "") {
    const s = String(status || "").toLowerCase();
    if (s === "pending") return "pendiente";
    if (s === "used")    return "aceptada";
    if (s === "revoked") return "revocada";
    if (s === "expired") return "expirada";
    return "sin invitación";
  }

  function renderTeachers() {
    if (!teachersList) return;
    const items = state.teachers || [];
    if (!items.length) { teachersList.innerHTML = '<p class="emptyState">No hay docentes creados todavía.</p>'; return; }
    teachersList.innerHTML = items.map(item => {
      const subjects = item.subjects?.length
        ? item.subjects.map(s => `<span class="chip">${escHtml(s)}</span>`).join("")
        : '<span class="teacherMeta">Sin materias</span>';
      const groups = item.groups?.length
        ? item.groups.map(g => `<span class="chip">${escHtml(g.name)}${g.is_tutor ? " (tutoría)" : ""}</span>`).join("")
        : '<span class="teacherMeta">Sin grupos</span>';
      const invite = item.invite || null;
      return `
        <article class="teacherCard">
          <div class="teacherTop">
            <div>
              <div class="teacherName">${escHtml(item.display_name || "Docente")}</div>
              <div class="teacherMeta">${escHtml(item.email || "")}</div>
            </div>
            <div class="teacherMeta">Invitación: ${inviteStatusLabel(invite?.status)}</div>
          </div>
          <div class="chips">${subjects}</div>
          <div class="chips">${groups}</div>
          <div class="row">
            ${invite?.status === "pending" ? `<button class="btn ghost small" data-revoke-id="${invite.id}">Revocar</button>` : ""}
          </div>
        </article>`;
    }).join("");
  }

  async function reloadTeachers() {
    const res = await fetchJSON("/api/v1/admin/teachers");
    state.teachers = toItems(res, "teachers");
    state.teachersLoaded = true;
    renderAssignmentSubjectSelect();
    renderTeachers();
  }

  // ── Invite actions ────────────────────────────────────────────────────────

  function resetInviteForm() {
    if (teacherEmail)       teacherEmail.value = "";
    if (teacherDisplayName) teacherDisplayName.value = "";
    assignments = [];
    pendingGroupIds.clear();
    renderPendingGroupChips();
    renderAssignmentsList();
    if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
    renderInviteSummary();
    showInviteStep("basics");
    setResult("");
    if (inviteResultEl) inviteResultEl.hidden = true;
    inviteBtnMode = "create";
    if (createTeacherInviteBtn) createTeacherInviteBtn.textContent = "Generar enlace de invitación";
    refreshInviteButtons();
  }

  async function createInvite() {
    setError("");
    setResult("");
    const email        = normalizeLabel(teacherEmail?.value);
    const displayName  = normalizeLabel(teacherDisplayName?.value);
    const tutorGroupId = normalizeLabel(groupsEls.tutorGroupSelect?.value) || null;

    if (!email)              return setError("Introduce el email del docente.");
    if (!displayName)        return setError("Introduce el nombre del docente.");
    if (!assignments.length) return setError("Añade al menos una asignación.");

    const data = await fetchJSON("/api/v1/admin/teachers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        display_name: displayName,
        assignments: assignments.map(a => ({ subject: a.subject, group_ids: a.group_ids })),
        tutor_group_id: tutorGroupId,
      }),
    });

    const invite    = data?.invite || {};
    const emailSent = data?.email_sent !== false;
    setResult(emailSent ? "Invitación creada correctamente." : "Invitación creada. Email no enviado — copia el enlace manualmente.");
    showInviteResult({ email: invite.email || email, inviteUrl: invite.invite_url || "", emailSent });
    inviteBtnMode = "reset";
    if (createTeacherInviteBtn) createTeacherInviteBtn.textContent = "Nueva invitación";
    await reloadTeachers();
  }

  async function revokeInvite(inviteId) {
    setError("");
    await fetchJSON(`/api/v1/admin/teachers/teacher-invites/${inviteId}/revoke`, { method: "POST" });
    await reloadTeachers();
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents() {
    clearInviteResultBtn?.addEventListener("click", () => { if (inviteResultEl) inviteResultEl.hidden = true; });

    const copyBtn   = document.getElementById("copyLinkBtn");
    const linkInput = document.getElementById("inviteLinkInput");
    const feedback  = document.getElementById("copyFeedback");
    if (copyBtn && linkInput) copyBtn.addEventListener("click", () => copyToClipboard(linkInput.value, feedback));

    inviteStartBtn?.addEventListener("click", () => {
      setError("");
      if (!normalizeLabel(teacherEmail?.value))       return setError("Introduce el email del docente.");
      if (!normalizeLabel(teacherDisplayName?.value)) return setError("Introduce el nombre del docente.");
      showInviteStep("assignments");
    });

    toTutorBtn?.addEventListener("click", () => {
      setError("");
      if (!assignments.length) return setError("Añade al menos una asignación.");
      showInviteStep("tutor");
    });

    createTeacherInviteBtn?.addEventListener("click", () => {
      if (inviteBtnMode === "reset") resetInviteForm();
      else createInvite().catch(err => setError(err?.message || "No se pudo crear la invitación."));
    });

    addAssignmentBtn?.addEventListener("click", addAssignment);

    assignmentSubjectSelect?.addEventListener("change", refreshAssignmentSubjectAddVisibility);
    assignmentSubjectAddBtn?.addEventListener("click", addAssignmentCustomSubject);
    assignmentSubjectInput?.addEventListener("keydown", ev => {
      if (ev.key === "Enter") { ev.preventDefault(); addAssignmentCustomSubject(); }
    });

    assignmentGroupSelect?.addEventListener("change", () => {
      const val = assignmentGroupSelect.value;
      if (!val) return;
      pendingGroupIds.add(val);
      assignmentGroupSelect.value = "";
      renderPendingGroupChips();
    });

    assignmentPendingGroupChips?.addEventListener("click", ev => {
      const btn = ev.target.closest("[data-remove-pending]");
      if (!btn) return;
      pendingGroupIds.delete(btn.dataset.removePending);
      renderPendingGroupChips();
    });

    assignmentsList?.addEventListener("click", ev => {
      const btn = ev.target.closest("[data-remove-assignment]");
      if (!btn) return;
      assignments.splice(Number(btn.dataset.removeAssignment), 1);
      renderAssignmentsList();
      renderInviteSummary();
      refreshInviteButtons();
    });

    teacherEmail?.addEventListener("input", refreshInviteButtons);
    teacherDisplayName?.addEventListener("input", refreshInviteButtons);
    groupsEls.tutorGroupSelect?.addEventListener("change", () => { renderInviteSummary(); refreshInviteButtons(); });

    teachersList?.addEventListener("click", ev => {
      const button = ev.target.closest("button[data-revoke-id]");
      if (!button) return;
      revokeInvite(button.dataset.revokeId).catch(err => setError(err?.message || "No se pudo revocar."));
    });
  }

  return { reloadTeachers, renderAssignmentSubjectSelect, renderInviteSummary, refreshInviteButtons, showInviteStep, wireEvents };
}
