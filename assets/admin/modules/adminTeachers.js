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

  // Whether the inline group selector is currently open
  let groupSelectorOpen = false;

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
    if (groupSelectorOpen && available.length) {
      const opts = available.map(g =>
        `<option value="${escHtml(g.id)}">${escHtml(g.name)}</option>`
      ).join("");
      selectorHtml = `
        <select class="av-select" id="groupSelectDropdown" autofocus>
          <option value="">— Selecciona un grupo —</option>
          ${opts}
        </select>`;
    } else if (!groupSelectorOpen) {
      const disabled = available.length === 0 ? " disabled" : "";
      selectorHtml = `<button class="av-add-group-btn" id="addGroupBtn" type="button"${disabled}>+ Añadir grupo</button>`;
    }

    assignBlock.innerHTML = cardsHtml + selectorHtml;

    // Wire the newly-rendered select immediately (can't use event delegation for autofocus/change)
    const sel = assignBlock.querySelector("#groupSelectDropdown");
    if (sel) {
      sel.focus();
      sel.addEventListener("change", () => {
        const groupId = sel.value;
        if (!groupId) { groupSelectorOpen = false; renderAssignBlock(); return; }
        const g = getGroups().find(x => x.id === groupId);
        if (g) addGroupEntry(g);
      });
      sel.addEventListener("blur", () => {
        // Small timeout so a click on an option registers before blur closes it
        setTimeout(() => {
          if (groupSelectorOpen) { groupSelectorOpen = false; renderAssignBlock(); }
        }, 150);
      });
    }
  }

  function addGroupEntry(g) {
    if (groupEntries.some(e => e.groupId === g.id)) return;
    groupEntries.push({
      groupId: g.id,
      groupName: g.name || g.id,
      groupLetter: groupLetter(g),
      groupMeta: groupMeta(g),
      selectedSubjects: new Set(),
    });
    groupSelectorOpen = false;
    renderAssignBlock();
    refreshInviteButtons();
  }

  function removeGroupEntry(groupId) {
    groupEntries = groupEntries.filter(e => e.groupId !== groupId);
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
    groupSelectorOpen = false;
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

    // Assign block — event delegation for subject chips, remove-group, add-group
    assignBlock?.addEventListener("click", ev => {
      // Subject chip toggle
      const chip = ev.target.closest(".av-subject-chip[data-subject]");
      if (chip) {
        toggleSubject(chip.dataset.groupId, chip.dataset.subject);
        return;
      }
      // Remove group button
      const removeBtn = ev.target.closest("[data-remove-group]");
      if (removeBtn) {
        removeGroupEntry(removeBtn.dataset.removeGroup);
        return;
      }
      // Add group button
      if (ev.target.closest("#addGroupBtn")) {
        groupSelectorOpen = true;
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
