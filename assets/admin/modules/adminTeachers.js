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

  // Stores invite_url per email (only available from POST response, not GET)
  const pendingInviteUrls = new Map();

  // Local expand state: Set of teacher keys (id || email)
  const expandedTeachers = new Set();

  // adminGroups es cargado con await en init(); allGroups depende de una
  // llamada async separada que puede no haberse completado aún.
  const getGroups = () => state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);

  // DOM refs
  const inviteNoticeEl        = document.getElementById("inviteNotice");
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
  const groupPickerFilter          = document.getElementById("groupPickerFilter");
  const groupPickerOptions         = document.getElementById("groupPickerOptions");
  const assignmentPendingGroupChips = document.getElementById("assignmentPendingGroupChips");
  const addAssignmentBtn           = document.getElementById("addAssignmentBtn");
  const assignmentsList            = document.getElementById("assignmentsList");
  const assignmentsError           = document.getElementById("assignmentsError");
  const inviteFormPanel            = document.getElementById("inviteFormPanel");
  const showInviteFormBtn          = document.getElementById("showInviteFormBtn");

  // ── Wizard steps ──────────────────────────────────────────────────────────

  function showInviteStep(stepName = "basics") {
    const map = { basics: inviteStepBasics, assignments: inviteStepAssignments, tutor: inviteStepTutor };
    Object.entries(map).forEach(([key, el]) => el?.classList.toggle("hidden", key !== stepName));
    if (stepName === "assignments") { renderAssignmentSubjectSelect(); renderGroupPicker(); }
    if (stepName === "tutor") renderTutorOptionsFromAssignments();
    refreshInviteButtons();
  }

  let _noticeClearTimer = null;
  function showNotice(msg) {
    if (!inviteNoticeEl) return;
    inviteNoticeEl.textContent = msg;
    inviteNoticeEl.classList.remove("hidden");
    if (_noticeClearTimer) clearTimeout(_noticeClearTimer);
    _noticeClearTimer = setTimeout(() => inviteNoticeEl?.classList.add("hidden"), 6000);
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
    const tutorLabel = tutorId ? getGroups().find(g => g.id === tutorId)?.name || tutorId : null;
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

  // ── Group picker (replaces native select) ────────────────────────────────

  function renderGroupPicker(filter = "") {
    if (!groupPickerOptions) return;
    const q = String(filter || (groupPickerFilter?.value || "")).toLowerCase().trim();
    const groups = getGroups().slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    const visible = q ? groups.filter(g => (g.name || "").toLowerCase().includes(q)) : groups;
    groupPickerOptions.innerHTML = "";
    visible.forEach(g => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "groupPickerBtn" + (pendingGroupIds.has(g.id) ? " selected" : "");
      btn.textContent = g.name || g.id;
      btn.dataset.groupId = g.id;
      btn.addEventListener("click", () => {
        if (pendingGroupIds.has(g.id)) pendingGroupIds.delete(g.id);
        else pendingGroupIds.add(g.id);
        btn.classList.toggle("selected", pendingGroupIds.has(g.id));
        renderPendingGroupChips();
      });
      groupPickerOptions.appendChild(btn);
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
    assignmentPendingGroupChips.classList.remove("hidden");
    assignmentPendingGroupChips.innerHTML = ids.map(id => {
      const name = getGroups().find(g => g.id === id)?.name || id;
      return `<span class="chip">${escHtml(name)}<button class="chipRemove" data-remove-pending="${id}" type="button" aria-label="Quitar">×</button></span>`;
    }).join("");
  }

  // ── Assignments management ────────────────────────────────────────────────

  function renderAssignmentsList() {
    if (!assignmentsList) return;
    if (!assignments.length) { assignmentsList.innerHTML = ""; return; }
    assignmentsList.innerHTML = assignments.map((a, i) => `
      <div class="av-assign-item" style="margin-top:8px">
        <div class="av-letter" style="font-family:var(--mono);font-style:normal;font-size:13px">
          ${escHtml(a.subject.charAt(0).toUpperCase())}
        </div>
        <div>
          <div class="av-assign-name">${escHtml(a.subject)}</div>
          <div class="av-assign-sub">${a.groupLabels.map(escHtml).join(", ")}</div>
        </div>
        <button class="av-icon-btn danger" data-remove-assignment="${i}" type="button" aria-label="Eliminar asignación">×</button>
      </div>`).join("");
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

    const groups = getGroups();
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
    const eligible = getGroups()
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

  function teacherInitials(name, email) {
    const words = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : String(words[0] || "?").slice(0, 2).toUpperCase();
  }

  function teacherStatusBadge(invite) {
    const s = String(invite?.status || "").toLowerCase();
    if (s === "used")    return `<span class="av-status ok"><span class="dot"></span>Activo</span>`;
    if (s === "pending") return `<span class="av-status pending"><span class="dot"></span>Pendiente</span>`;
    if (s === "revoked") return `<span class="av-status"><span class="dot"></span>Revocada</span>`;
    return `<span></span>`; // placeholder para mantener el grid de 4 columnas
  }

  // Invierte groups[].subjects[] → Map<subjectName, groupName[]>
  function groupBySubject(item) {
    const map = new Map();
    for (const g of (item.groups || [])) {
      for (const s of (g.subjects || [])) {
        if (!s) continue;
        const list = map.get(s) || [];
        list.push(g.name);
        map.set(s, list);
      }
    }
    return map;
  }

  function renderTeachers() {
    if (!teachersList) return;
    const items = state.teachers || [];
    if (!items.length) { teachersList.innerHTML = '<p class="emptyState">No hay docentes creados todavía.</p>'; return; }

    teachersList.innerHTML = items.map(item => {
      const invite     = item.invite || null;
      const isPending  = invite?.status === "pending";
      const initials   = teacherInitials(item.display_name, item.email);
      const teacherKey = item.id || item.email;
      const isExpanded = expandedTeachers.has(teacherKey);

      const verGruposBtn = `<button class="btn ghost small" data-ver-grupos="${escHtml(teacherKey)}" type="button">${isExpanded ? "Ocultar" : "Ver grupos"}</button>`;

      let expandHtml = "";
      if (isExpanded) {
        const copyLinkBtn = (isPending && pendingInviteUrls.has(item.email))
          ? `<button class="btn ghost small copyInviteLinkBtn" data-copy-invite-email="${escHtml(item.email)}" type="button">Copiar enlace</button>`
          : "";
        const revokeBtn = isPending && invite?.id
          ? `<button class="btn ghost small" data-revoke-id="${invite.id}" type="button">Revocar</button>`
          : "";
        const actionsHtml = (revokeBtn || copyLinkBtn)
          ? `<div class="av-doc-actions">${revokeBtn}${copyLinkBtn}</div>`
          : "";

        const bySubject = groupBySubject(item);
        const subjectRowsHtml = bySubject.size
          ? [...bySubject.entries()].map(([subject, groups]) => `
              <div class="av-subject-row">
                <span class="av-subject-name">${escHtml(subject)}</span>
                <div class="av-subject-groups">${groups.map(g => `<span class="av-chip">${escHtml(g)}</span>`).join("")}</div>
              </div>`).join("")
          : `<p class="av-no-assign">Sin asignaciones configuradas</p>`;

        expandHtml = `
          <div class="av-doc-expand">
            ${subjectRowsHtml}
            ${actionsHtml}
          </div>`;
      }

      return `
        <div class="av-doc-entry${isExpanded ? " expanded" : ""}" data-teacher-key="${escHtml(teacherKey)}">
          <div class="av-doc-row${isPending ? " pending" : ""}">
            <div class="av-avatar">${escHtml(initials)}</div>
            <div>
              <div class="av-cell-name">${escHtml(item.display_name || "Docente")}</div>
              <div class="av-cell-sub">${escHtml(item.email || "")}</div>
            </div>
            ${teacherStatusBadge(invite)}
            ${verGruposBtn}
          </div>
          ${expandHtml}
        </div>`;
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

  function closeInvitePanel() {
    inviteFormPanel?.classList.add("hidden");
    if (showInviteFormBtn) showInviteFormBtn.textContent = "+ Invitar docente";
    resetInviteForm();
  }

  function resetInviteForm() {
    if (teacherEmail)       teacherEmail.value = "";
    if (teacherDisplayName) teacherDisplayName.value = "";
    assignments = [];
    pendingGroupIds.clear();
    if (groupPickerFilter) groupPickerFilter.value = "";
    renderPendingGroupChips();
    renderGroupPicker();
    renderAssignmentsList();
    if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
    renderInviteSummary();
    showInviteStep("basics");
    refreshInviteButtons();
  }

  async function createInvite() {
    setError("");
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

    // Store invite URL (not returned by GET /teachers)
    if (invite.invite_url) pendingInviteUrls.set(email, invite.invite_url);

    // Optimistic entry — prepend to list before server round-trip
    const allGroups = getGroups();
    const optimisticTeacher = {
      email,
      display_name: displayName,
      subjects: uniq(assignments.map(a => a.subject)),
      groups: uniq(assignments.flatMap(a => a.group_ids)).map(id => ({
        id,
        name: allGroups.find(g => g.id === id)?.name || id,
        is_tutor: id === tutorGroupId,
      })),
      invite: { status: "pending", id: invite.id || null },
    };
    state.teachers = [optimisticTeacher, ...(state.teachers || []).filter(t => t.email !== email)];
    renderTeachers();

    // Close form and show brief notice
    closeInvitePanel();
    const noticeMsg = emailSent
      ? `Invitación enviada a ${email}`
      : `Invitación creada para ${email} (email no enviado — usa "Copiar enlace")`;
    showNotice(noticeMsg);

    // Background reload to replace optimistic with real data
    reloadTeachers().catch(console.error);
  }

  async function revokeInvite(inviteId) {
    setError("");
    await fetchJSON(`/api/v1/admin/teachers/teacher-invites/${inviteId}/revoke`, { method: "POST" });
    await reloadTeachers();
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents() {
    showInviteFormBtn?.addEventListener("click", () => {
      const isOpen = !inviteFormPanel?.classList.contains("hidden");
      if (isOpen) {
        inviteFormPanel?.classList.add("hidden");
        if (showInviteFormBtn) showInviteFormBtn.textContent = "+ Invitar docente";
        resetInviteForm();
      } else {
        inviteFormPanel?.classList.remove("hidden");
        if (showInviteFormBtn) showInviteFormBtn.textContent = "× Cancelar";
        renderGroupPicker();
      }
    });

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
      createInvite().catch(err => setError(err?.message || "No se pudo crear la invitación."));
    });

    addAssignmentBtn?.addEventListener("click", addAssignment);

    assignmentSubjectSelect?.addEventListener("change", refreshAssignmentSubjectAddVisibility);
    assignmentSubjectAddBtn?.addEventListener("click", addAssignmentCustomSubject);
    assignmentSubjectInput?.addEventListener("keydown", ev => {
      if (ev.key === "Enter") { ev.preventDefault(); addAssignmentCustomSubject(); }
    });

    groupPickerFilter?.addEventListener("input", () => renderGroupPicker());

    assignmentPendingGroupChips?.addEventListener("click", ev => {
      const btn = ev.target.closest("[data-remove-pending]");
      if (!btn) return;
      const id = btn.dataset.removePending;
      pendingGroupIds.delete(id);
      renderPendingGroupChips();
      groupPickerOptions?.querySelector(`[data-group-id="${id}"]`)?.classList.remove("selected");
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

      // Ver grupos toggle
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

  return { reloadTeachers, renderAssignmentSubjectSelect, renderGroupPicker, renderInviteSummary, refreshInviteButtons, showInviteStep, wireEvents, closeInvitePanel };
}
