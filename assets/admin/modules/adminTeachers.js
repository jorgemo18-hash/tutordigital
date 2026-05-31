import { escHtml, normalizeLabel, uniq, copyToClipboard, fetchJSON, toItems } from "./adminUtils.js";

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SUBJECTS = [
  "Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología",
  "Historia", "Geografía", "Filosofía", "Economía", "Tecnología",
  "Música", "Educación Física", "Plástica", "Francés",
];

// ── Init ───────────────────────────────────────────────────────────────────

export function initTeacherSection({ state, groupsEls, setError }) {

  // Stores invite_url per email (only available from POST response, not GET)
  const pendingInviteUrls = new Map();

  // Local expand state for the teachers list
  const expandedTeachers = new Set();

  // Form state: one entry per group added to the invite form
  // [{groupId, groupName, groupLetter, groupMeta, selectedSubjects: Set<string>}]
  let groupEntries = [];

  // 3-step inline picker state
  // pickerStep: 0=closed, 1=course selection, 2=track selection
  let pickerStep = 0;
  let pickerCourse = null; // {stage, year, label}
  let pickerTrackSet = new Set(); // Set<groupId> toggled in step 2

  // Optional tutor group selection (single choice, null = none)
  let tutorGroupId = null;

  const getGroups = () => state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);

  // DOM refs
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

  // ── Group entry helpers ───────────────────────────────────────────────────

  function groupLetter(g) {
    const level = String(g.level || g.stage || "").toLowerCase();
    if (level.includes("bach")) return "B";
    if (level.includes("eso") || level.includes("secund")) return "E";
    if (level.includes("prima")) return "P";
    return (g.name || "?")[0].toUpperCase();
  }

  function groupMeta(g) {
    const parts = [g.level, g.course].filter(Boolean);
    if (g.students != null) parts.push(`${g.students} alumnos`);
    return parts.join(" · ");
  }

  const STAGE_KEYS  = ["primaria", "eso", "bachiller", "otros"];
  const STAGE_LABEL = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato", otros: "Otros" };

  function inferStageFromGroup(g) {
    const raw = String(g.level || g.stage || g.name || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (raw.includes("prim")) return "primaria";
    if (raw.includes("eso") || raw.includes("secund")) return "eso";
    if (raw.includes("bach")) return "bachiller";
    return "otros";
  }

  function inferYearFromGroup(g) {
    const fromField = Number(g.year || 0);
    if (Number.isInteger(fromField) && fromField >= 1 && fromField <= 6) return fromField;
    const m = String(g.course || g.name || "").match(/\b([1-6])[ºo°]?/);
    return m ? Number(m[1]) : 0;
  }

  function extractTrack(g) {
    if (g.track) return String(g.track).toUpperCase().trim();
    const norm = String(g.normalized_name || "");
    if (norm.includes("|")) {
      const last = norm.split("|").at(-1).toUpperCase().trim();
      if (last) return last;
    }
    return String(g.name || "").trim().split(/\s+/).at(-1).toUpperCase();
  }

  // Returns sorted unique [{stage, year, key, label}] from a group list
  function coursesFromGroups(groups) {
    const seen = new Map();
    for (const g of groups) {
      const stage = inferStageFromGroup(g);
      const year  = inferYearFromGroup(g);
      if (!year) continue;
      const key = `${stage}|${year}`;
      if (!seen.has(key)) {
        seen.set(key, { stage, year, key, label: `${STAGE_LABEL[stage] || stage} ${year}º` });
      }
    }
    return [...seen.values()].sort((a, b) => {
      const si = STAGE_KEYS.indexOf(a.stage) - STAGE_KEYS.indexOf(b.stage);
      return si !== 0 ? si : a.year - b.year;
    });
  }

  function groupsForCourse(groups, stage, year) {
    return groups.filter(g => inferStageFromGroup(g) === stage && inferYearFromGroup(g) === year);
  }

  function subjectCatalog() {
    const fromTeachers = (state.teachers || []).flatMap(t => t.subjects || []);
    return uniq([...DEFAULT_SUBJECTS, ...fromTeachers]).sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }

  // ── Assign block renderer ─────────────────────────────────────────────────

  function renderAssignBlock() {
    if (!assignBlock) return;

    const addedIds = new Set(groupEntries.map(e => e.groupId));
    const available = getGroups().filter(g => !addedIds.has(g.id));
    const subjects = subjectCatalog();

    const cardsHtml = groupEntries.map(entry => {
      const count = entry.selectedSubjects.size;
      const countLabel = count === 0 ? "Ninguna seleccionada"
        : count === 1 ? "1 seleccionada"
        : `${count} seleccionadas`;

      const chipsHtml = subjects.map(s => {
        const active = entry.selectedSubjects.has(s) ? " active" : "";
        return `<span class="av-subject-chip${active}" data-subject="${escHtml(s)}" data-group-id="${escHtml(entry.groupId)}">${escHtml(s)}</span>`;
      }).join("");

      return `
        <div class="av-assign-entry" data-group-id="${escHtml(entry.groupId)}">
          <div class="av-assign-item">
            <div class="av-letter">${escHtml(entry.groupLetter)}</div>
            <div>
              <div class="av-assign-name">${escHtml(entry.groupName)}</div>
              ${entry.groupMeta ? `<div class="av-assign-sub">${escHtml(entry.groupMeta)}</div>` : ""}
            </div>
            <button class="av-icon-btn danger" data-remove-group="${escHtml(entry.groupId)}" type="button" title="Quitar grupo">×</button>
          </div>
          <div class="av-assign-subjects">
            <div class="av-assign-subjects-head">
              <span class="av-label">Asignaturas que impartirá</span>
              <span class="av-row-meta">${escHtml(countLabel)}</span>
            </div>
            <div class="av-subject-pick">${chipsHtml}</div>
          </div>
        </div>`;
    }).join("");

    let selectorHtml = "";

    if (pickerStep === 1) {
      // ── Step 1: choose course ─────────────────────────────────────────────
      const courses = coursesFromGroups(available);
      if (!courses.length) {
        selectorHtml = `
          <div class="av-group-picker">
            <div class="av-group-picker-head">
              <span class="av-label">Añadir grupo</span>
              <button class="av-icon-btn" data-cancel-group-picker type="button" title="Cerrar">×</button>
            </div>
            <p class="av-no-assign">Todos los grupos han sido añadidos.</p>
          </div>`;
      } else {
        // Group courses by stage for section headers
        const byStage = {};
        for (const c of courses) (byStage[c.stage] = byStage[c.stage] || []).push(c);
        const stagesHtml = STAGE_KEYS
          .filter(s => byStage[s])
          .map(s => {
            const chips = byStage[s].map(c =>
              `<span class="av-subject-chip" data-pick-course="${escHtml(c.key)}">${escHtml(c.label)}</span>`
            ).join("");
            return `<div class="av-group-picker-stage">
              <span class="av-label">${escHtml(STAGE_LABEL[s])}</span>
              <div class="av-subject-pick">${chips}</div>
            </div>`;
          }).join("");
        selectorHtml = `
          <div class="av-group-picker">
            <div class="av-group-picker-head">
              <span class="av-label">Elige el curso</span>
              <button class="av-icon-btn" data-cancel-group-picker type="button" title="Cerrar">×</button>
            </div>
            ${stagesHtml}
          </div>`;
      }

    } else if (pickerStep === 2 && pickerCourse) {
      // ── Step 2: choose tracks (vías) ──────────────────────────────────────
      const courseGroups = groupsForCourse(available, pickerCourse.stage, pickerCourse.year);
      const trackChips = courseGroups.map(g => {
        const track = extractTrack(g);
        const active = pickerTrackSet.has(g.id) ? " active" : "";
        return `<span class="av-subject-chip${active}" data-pick-track="${escHtml(g.id)}" title="${escHtml(g.name)}">${escHtml(track)}</span>`;
      }).join("");
      const canConfirm = pickerTrackSet.size > 0;
      selectorHtml = `
        <div class="av-group-picker">
          <div class="av-group-picker-head">
            <span class="av-label">${escHtml(pickerCourse.label)} — elige vías</span>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn ghost small" data-back-to-step1 type="button">← Curso</button>
              <button class="av-icon-btn" data-cancel-group-picker type="button" title="Cerrar">×</button>
            </div>
          </div>
          <div class="av-subject-pick">${trackChips}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:4px">
            <button class="btn primary small" data-confirm-tracks type="button"${canConfirm ? "" : " disabled"}>Añadir vías seleccionadas →</button>
          </div>
        </div>`;

    } else {
      const allCoursesDone = coursesFromGroups(available).length === 0;
      const disabled = allCoursesDone ? " disabled" : "";
      selectorHtml = `<button class="av-add-group-btn" id="addGroupBtn" type="button"${disabled}>+ Añadir grupo</button>`;
    }

    const tutorHtml = groupEntries.length ? `
      <div class="av-tutor-section">
        <span class="av-label">Tutoría <span class="av-label-opt">(opcional)</span></span>
        <div class="av-subject-pick">
          ${groupEntries.map(e => {
            const active = tutorGroupId === e.groupId ? " active" : "";
            return `<span class="av-subject-chip${active}" data-tutor-group="${escHtml(e.groupId)}">${escHtml(e.groupName)}</span>`;
          }).join("")}
        </div>
      </div>` : "";

    assignBlock.innerHTML = cardsHtml + tutorHtml + selectorHtml;
  }

  function addGroupEntry(g, { skipRender = false } = {}) {
    if (groupEntries.some(e => e.groupId === g.id)) return;
    groupEntries.push({
      groupId: g.id,
      groupName: g.name || g.id,
      groupLetter: groupLetter(g),
      groupMeta: groupMeta(g),
      selectedSubjects: new Set(),
    });
    if (!skipRender) {
      renderAssignBlock();
      refreshInviteButtons();
    }
  }

  function removeGroupEntry(groupId) {
    groupEntries = groupEntries.filter(e => e.groupId !== groupId);
    if (tutorGroupId === groupId) tutorGroupId = null;
    renderAssignBlock();
    refreshInviteButtons();
  }

  function toggleSubject(groupId, subject) {
    const entry = groupEntries.find(e => e.groupId === groupId);
    if (!entry) return;
    if (entry.selectedSubjects.has(subject)) entry.selectedSubjects.delete(subject);
    else entry.selectedSubjects.add(subject);
    // Update only the affected chip and counter without full re-render
    const block = assignBlock?.querySelector(`[data-group-id="${groupId}"] .av-assign-subjects`);
    if (block) {
      const chip = block.querySelector(`[data-subject="${subject}"]`);
      if (chip) chip.classList.toggle("active", entry.selectedSubjects.has(subject));
      const meta = block.querySelector(".av-row-meta");
      if (meta) {
        const n = entry.selectedSubjects.size;
        meta.textContent = n === 0 ? "Ninguna seleccionada" : n === 1 ? "1 seleccionada" : `${n} seleccionadas`;
      }
    }
    refreshInviteButtons();
  }

  // ── Payload builder ───────────────────────────────────────────────────────

  function buildAssignments() {
    const map = new Map(); // subject → Set<groupId>
    for (const entry of groupEntries) {
      for (const subject of entry.selectedSubjects) {
        const set = map.get(subject) || new Set();
        set.add(entry.groupId);
        map.set(subject, set);
      }
    }
    return [...map.entries()].map(([subject, groupIds]) => ({
      subject,
      group_ids: [...groupIds],
    }));
  }

  // ── Form controls ─────────────────────────────────────────────────────────

  function refreshInviteButtons() {
    if (!sendInviteBtn) return;
    const hasEmail = Boolean(normalizeLabel(teacherEmail?.value));
    const hasGroups = groupEntries.length > 0;
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
    groupEntries = [];
    pickerStep = 0;
    pickerCourse = null;
    pickerTrackSet.clear();
    tutorGroupId = null;
    renderAssignBlock();
    refreshInviteButtons();
  }

  // ── Invite actions ────────────────────────────────────────────────────────

  async function createInvite() {
    setError("");
    const email       = normalizeLabel(teacherEmail?.value);
    const displayName = normalizeLabel(teacherDisplayName?.value) || null;
    const assignments = buildAssignments();

    if (!email)              return setError("Introduce el email del docente.");
    if (!groupEntries.length) return setError("Añade al menos un grupo.");
    if (!assignments.length) return setError("Selecciona al menos una asignatura en algún grupo.");

    const data = await fetchJSON("/api/v1/admin/teachers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        display_name: displayName || email.split("@")[0],
        assignments,
        tutor_group_id: tutorGroupId || null,
      }),
    });

    const invite    = data?.invite || {};
    const emailSent = data?.email_sent !== false;

    if (invite.invite_url) pendingInviteUrls.set(email, invite.invite_url);

    // Optimistic entry
    const allGroups = getGroups();
    const optimisticTeacher = {
      email,
      display_name: displayName || email.split("@")[0],
      subjects: uniq(assignments.map(a => a.subject)),
      groups: uniq(assignments.flatMap(a => a.group_ids)).map(id => ({
        id,
        name: allGroups.find(g => g.id === id)?.name || id,
        is_tutor: false,
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
    return `<span></span>`;
  }

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
    if (!items.length) {
      teachersList.innerHTML = '<p class="emptyState">No hay docentes creados todavía.</p>';
      return;
    }

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
    renderTeachers();
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents() {
    // Open / close the invite panel
    showInviteFormBtn?.addEventListener("click", () => {
      const isOpen = !inviteFormPanel?.classList.contains("hidden");
      if (isOpen) {
        closeInvitePanel();
      } else {
        inviteFormPanel?.classList.remove("hidden");
        if (showInviteFormBtn) showInviteFormBtn.textContent = "× Cancelar";
        renderAssignBlock();
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

    // Assign block — event delegation
    assignBlock?.addEventListener("click", ev => {
      // Subject chip toggle (data-subject present)
      const subjectChip = ev.target.closest(".av-subject-chip[data-subject]");
      if (subjectChip) {
        toggleSubject(subjectChip.dataset.groupId, subjectChip.dataset.subject);
        return;
      }
      // Tutor group selection (single-choice toggle)
      const tutorChip = ev.target.closest("[data-tutor-group]");
      if (tutorChip) {
        const id = tutorChip.dataset.tutorGroup;
        tutorGroupId = tutorGroupId === id ? null : id;
        renderAssignBlock();
        return;
      }
      // Step 1: course chip selected
      const courseChip = ev.target.closest("[data-pick-course]");
      if (courseChip) {
        const [stage, yearStr] = courseChip.dataset.pickCourse.split("|");
        const year = Number(yearStr);
        pickerCourse = { stage, year, label: `${STAGE_LABEL[stage] || stage} ${year}º` };
        pickerTrackSet.clear();
        pickerStep = 2;
        renderAssignBlock();
        return;
      }
      // Step 2: track chip toggled
      const trackChip = ev.target.closest("[data-pick-track]");
      if (trackChip) {
        const id = trackChip.dataset.pickTrack;
        if (pickerTrackSet.has(id)) pickerTrackSet.delete(id);
        else pickerTrackSet.add(id);
        renderAssignBlock();
        return;
      }
      // Step 2: confirm tracks → create cards
      if (ev.target.closest("[data-confirm-tracks]")) {
        const addedIds = new Set(groupEntries.map(e => e.groupId));
        const available = getGroups().filter(g => !addedIds.has(g.id));
        for (const id of pickerTrackSet) {
          const g = available.find(x => x.id === id);
          if (g) addGroupEntry(g, { skipRender: true });
        }
        pickerStep = 0;
        pickerCourse = null;
        pickerTrackSet.clear();
        renderAssignBlock();
        refreshInviteButtons();
        return;
      }
      // Back to step 1
      if (ev.target.closest("[data-back-to-step1]")) {
        pickerStep = 1;
        pickerCourse = null;
        pickerTrackSet.clear();
        renderAssignBlock();
        return;
      }
      // Cancel picker
      if (ev.target.closest("[data-cancel-group-picker]")) {
        pickerStep = 0;
        pickerCourse = null;
        pickerTrackSet.clear();
        renderAssignBlock();
        return;
      }
      // Remove group card
      const removeBtn = ev.target.closest("[data-remove-group]");
      if (removeBtn) {
        removeGroupEntry(removeBtn.dataset.removeGroup);
        return;
      }
      // Open picker (step 1)
      if (ev.target.closest("#addGroupBtn")) {
        pickerStep = 1;
        renderAssignBlock();
        return;
      }
    });

    // Teachers list — expand/collapse + revoke + copy
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

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    reloadTeachers,
    refreshInviteButtons,
    wireEvents,
    closeInvitePanel,
    // No-ops para compatibilidad con las llamadas en admin.js
    renderInviteSummary: () => {},
    renderGroupPicker: () => {},
    renderAssignmentSubjectSelect: () => {},
    showInviteStep: () => {},
  };
}
