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

export function initTeacherSection({ state, groupsEls, getGroupsModule, setError }) {
  const selectedSubjects = new Set();
  let inviteBtnMode = "create";

  // DOM refs
  const resultEl          = document.getElementById("adminInviteResult");
  const inviteResultEl    = document.getElementById("inviteResult");
  const inviteEmailValueEl= document.getElementById("inviteEmailValue");
  const clearInviteResultBtn = document.getElementById("clearInviteResultBtn");
  const teacherEmail      = document.getElementById("teacherEmail");
  const teacherDisplayName= document.getElementById("teacherDisplayName");
  const subjectSelect     = document.getElementById("subjectSelect");
  const subjectAddWrap    = document.getElementById("subjectAddWrap");
  const subjectAddInput   = document.getElementById("subjectAddInput");
  const subjectAddBtn     = document.getElementById("subjectAddBtn");
  const subjectChips      = document.getElementById("subjectChips");
  const summarySubjectChips = document.getElementById("summarySubjectChips");
  const summaryGroupChips   = document.getElementById("summaryGroupChips");
  const summaryTutorChip    = document.getElementById("summaryTutorChip");
  const teachersList        = document.getElementById("teachersList");
  const createTeacherInviteBtn = document.getElementById("createTeacherInviteBtn");
  const inviteStartBtn    = document.getElementById("inviteStartBtn");
  const toGroupsBtn       = document.getElementById("toGroupsBtn");
  const toTutorBtn        = document.getElementById("toTutorBtn");
  const inviteStepBasics  = document.getElementById("inviteStepBasics");
  const inviteStepSubjects= document.getElementById("inviteStepSubjects");
  const inviteStepGroups  = document.getElementById("inviteStepGroups");
  const inviteStepTutor   = document.getElementById("inviteStepTutor");

  // ── Wizard steps ──────────────────────────────────────────────────────────

  function showInviteStep(stepName = "basics") {
    const map = { basics: inviteStepBasics, subjects: inviteStepSubjects, groups: inviteStepGroups, tutor: inviteStepTutor };
    Object.entries(map).forEach(([key, el]) => el?.classList.toggle("hidden", key !== stepName));
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
        ? `<div style="margin-top:8px; opacity:0.9;">Supabase ha enviado un email de invitación. También puedes copiar el enlace y enviarlo manualmente.</div>`
        : `<div style="margin-top:8px; color:#c9723a; font-weight:600;">⚠️ No se pudo enviar el email automáticamente. Copia este enlace y envíaselo al docente manualmente.</div>`;
      inviteEmailValueEl.innerHTML = `<div>Invitación para: <strong>${escHtml(email)}</strong></div>${subtitle}`;
    }
    const linkBox   = document.getElementById("inviteLinkBox");
    const linkInput = document.getElementById("inviteLinkInput");
    if (linkBox && linkInput && inviteUrl) { linkInput.value = inviteUrl; linkBox.hidden = false; }
    else if (linkBox) linkBox.hidden = true;
    inviteResultEl.hidden = false;
  }

  function groupLabelById(id) {
    const row = (state.allGroups || []).find(
      (g) => String(g?.id || g?.group_id || g?.slug || g?.code || "") === String(id)
    );
    return row?.name || row?.label || row?.title || row?.slug || String(id);
  }

  function renderInviteSummary() {
    const subjectItems = [...selectedSubjects].sort((a, b) => a.localeCompare(b, "es")).map((s) => ({ key: s, label: s }));
    renderChips(summarySubjectChips, subjectItems, (subject) => { selectedSubjects.delete(subject); renderSubjectChips(); });

    const groupItems = [...state.selectedGroupIds].map((id) => ({ key: id, label: groupLabelById(id) })).sort((a, b) => a.label.localeCompare(b.label, "es"));
    renderChips(summaryGroupChips, groupItems, (id) => {
      state.selectedGroupIds.delete(id);
      if (groupsEls.tutorGroupSelect?.value === id) groupsEls.tutorGroupSelect.value = "";
      getGroupsModule()?.renderGroupsUI();
      getGroupsModule()?.renderTutorOptions();
    });

    const tutorId = normalizeLabel(groupsEls.tutorGroupSelect?.value);
    const tutorItems = tutorId ? [{ key: tutorId, label: groupLabelById(tutorId) }] : [];
    renderChips(summaryTutorChip, tutorItems, () => {
      if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
      renderInviteSummary();
      refreshInviteButtons();
    });
  }

  function refreshInviteButtons() {
    const hasBasics   = Boolean(normalizeLabel(teacherEmail?.value) && normalizeLabel(teacherDisplayName?.value));
    const hasSubjects = selectedSubjects.size > 0;
    const hasGroups   = state.selectedGroupIds.size > 0;
    if (inviteStartBtn)          inviteStartBtn.disabled = !hasBasics;
    if (toGroupsBtn)             toGroupsBtn.disabled = !hasSubjects;
    if (toTutorBtn)              toTutorBtn.disabled = !hasGroups;
    if (createTeacherInviteBtn)  createTeacherInviteBtn.disabled = !(hasBasics && hasSubjects && hasGroups);
  }

  // ── Subjects ──────────────────────────────────────────────────────────────

  function renderSubjectChips() {
    const items = [...selectedSubjects].sort((a, b) => a.localeCompare(b, "es")).map((s) => ({ key: s, label: s }));
    renderChips(subjectChips, items, (subject) => { selectedSubjects.delete(subject); renderSubjectChips(); });
    renderInviteSummary();
    refreshInviteButtons();
  }

  function refreshSubjectAddVisibility() {
    if (!subjectAddWrap || !subjectSelect) return;
    const show = String(subjectSelect.value || "") === SUBJECT_OTHER;
    subjectAddWrap.classList.toggle("hidden", !show);
    if (!show && subjectAddInput) subjectAddInput.value = "";
  }

  function addSubject(subject) {
    const selected = normalizeLabel(subject);
    if (!selected || selected === SUBJECT_PLACEHOLDER || selected === SUBJECT_OTHER) return;
    selectedSubjects.add(selected);
    renderSubjectChips();
  }

  function addCustomSubject() {
    const value = normalizeLabel(subjectAddInput?.value);
    if (!value) return;
    state.customSubjects = uniq([...state.customSubjects, value]);
    addSubject(value);
    subjectAddInput.value = "";
    renderSubjectSelect();
    if (subjectSelect) subjectSelect.value = SUBJECT_OTHER;
    refreshSubjectAddVisibility();
    subjectAddInput?.focus();
  }

  function renderSubjectSelect() {
    if (!subjectSelect) return;
    const fromTeachers = (state.teachers || []).flatMap((t) => t.subjects || []);
    const catalog = uniq([...DEFAULT_SUBJECTS, ...state.customSubjects, ...fromTeachers]).sort((a, b) => a.localeCompare(b, "es"));
    subjectSelect.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = SUBJECT_PLACEHOLDER; ph.textContent = "Selecciona materia..."; ph.selected = true; ph.disabled = true;
    subjectSelect.appendChild(ph);
    catalog.forEach((subject) => {
      const opt = document.createElement("option");
      opt.value = subject; opt.textContent = subject;
      subjectSelect.appendChild(opt);
    });
    const other = document.createElement("option");
    other.value = SUBJECT_OTHER; other.textContent = "Otro…";
    subjectSelect.appendChild(other);
    subjectSelect.value = SUBJECT_PLACEHOLDER;
    refreshSubjectAddVisibility();
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
    teachersList.innerHTML = items.map((item) => {
      const subjects = item.subjects?.length
        ? item.subjects.map((s) => `<span class="chip">${escHtml(s)}</span>`).join("")
        : '<span class="teacherMeta">Sin materias</span>';
      const groups = item.groups?.length
        ? item.groups.map((g) => `<span class="chip">${escHtml(g.name)}${g.is_tutor ? " (tutoría)" : ""}</span>`).join("")
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
    const teachersRes = await fetchJSON("/api/v1/admin/teachers");
    state.teachers = toItems(teachersRes, "teachers");
    state.teachersLoaded = true;
    renderSubjectSelect();
    renderSubjectChips();
    renderTeachers();
  }

  // ── Invite actions ────────────────────────────────────────────────────────

  function resetInviteForm() {
    if (teacherEmail)      teacherEmail.value = "";
    if (teacherDisplayName) teacherDisplayName.value = "";
    selectedSubjects.clear();
    renderSubjectChips();
    state.selectedGroupIds.clear();
    if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
    getGroupsModule()?.renderGroupsUI();
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
    const email       = normalizeLabel(teacherEmail?.value);
    const displayName = normalizeLabel(teacherDisplayName?.value);
    const subjects    = [...selectedSubjects];
    const groupIds    = [...state.selectedGroupIds];
    const tutorGroupId = normalizeLabel(groupsEls.tutorGroupSelect?.value) || null;

    if (!email)          return setError("Introduce el email del docente.");
    if (!displayName)    return setError("Introduce el nombre del docente.");
    if (!subjects.length) return setError("Añade al menos una materia.");
    if (!groupIds.length) return setError("Selecciona al menos un grupo (etapa + curso + vías).");

    const data = await fetchJSON("/api/v1/admin/teachers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, display_name: displayName, subjects, group_ids: groupIds, tutor_group_id: tutorGroupId }),
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
      showInviteStep("subjects");
    });
    toGroupsBtn?.addEventListener("click", () => {
      setError("");
      if (!selectedSubjects.size) return setError("Añade al menos una materia.");
      showInviteStep("groups");
    });
    toTutorBtn?.addEventListener("click", () => {
      setError("");
      if (!state.selectedGroupIds.size) return setError("Selecciona al menos un grupo.");
      showInviteStep("tutor");
    });
    createTeacherInviteBtn?.addEventListener("click", () => {
      if (inviteBtnMode === "reset") resetInviteForm();
      else createInvite().catch((err) => setError(err?.message || "No se pudo crear la invitación."));
    });
    subjectAddBtn?.addEventListener("click", addCustomSubject);
    teacherEmail?.addEventListener("input", refreshInviteButtons);
    teacherDisplayName?.addEventListener("input", refreshInviteButtons);
    groupsEls.tutorGroupSelect?.addEventListener("change", () => { renderInviteSummary(); refreshInviteButtons(); });
    subjectSelect?.addEventListener("change", () => {
      const val = normalizeLabel(subjectSelect.value);
      if (!val || val === SUBJECT_PLACEHOLDER) return;
      if (val === SUBJECT_OTHER) { refreshSubjectAddVisibility(); subjectAddInput?.focus(); return; }
      addSubject(val);
      subjectSelect.value = SUBJECT_PLACEHOLDER;
      refreshSubjectAddVisibility();
    });
    subjectAddInput?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addCustomSubject(); } });
    teachersList?.addEventListener("click", (ev) => {
      const button = ev.target.closest("button[data-revoke-id]");
      if (!button) return;
      revokeInvite(button.dataset.revokeId).catch((err) => setError(err?.message || "No se pudo revocar."));
    });
  }

  return { reloadTeachers, renderSubjectSelect, renderSubjectChips, renderInviteSummary, refreshInviteButtons, showInviteStep, refreshSubjectAddVisibility, wireEvents };
}
