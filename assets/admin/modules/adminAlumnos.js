import { escHtml, fetchJSON, toItems, copyToClipboard } from "./adminUtils.js";

// ── Init ───────────────────────────────────────────────────────────────────

export function initAlumnosSection({ state, gruposGoTo, renderGrupos }) {

  // In-memory store for invite URLs (only available from POST/resend response)
  const pendingStudentInviteUrls = new Map();

  function studentStatusLabel(status) {
    if (status === "pending") return "pendiente";
    if (status === "used")    return "registrado";
    if (status === "revoked") return "revocado";
    if (status === "expired") return "expirada";
    return String(status || "");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderStudentsList() {
    const el = document.getElementById("studentsList");
    if (!el) return;
    const students = (state.groupStudents || []).filter((s) => s.status !== "revoked");
    if (!students.length) { el.innerHTML = '<p class="emptyState">No hay alumnos invitados todavía.</p>'; return; }
    el.innerHTML = students.map((s) => {
      const canRevoke = s.status === "pending" || s.status === "used";
      const canResend = s.status === "pending";
      const hasCopyLink = canResend && pendingStudentInviteUrls.has(s.id);
      return `
        <div class="studentRow">
          <span class="studentEmail">${escHtml(s.email)}</span>
          <span class="statusBadge status-${s.status}">${studentStatusLabel(s.status)}</span>
          <div class="studentRowActions">
            ${canResend ? `<button class="btn ghost small" data-resend-student="${s.id}" type="button">Reenviar</button>` : ""}
            ${hasCopyLink ? `<button class="btn ghost small" data-copy-student-link="${s.id}" type="button">Copiar enlace</button>` : ""}
            ${canRevoke ? `<button class="btn ghost small" data-revoke-student="${s.id}" type="button">Revocar</button>` : `<span></span>`}
          </div>
        </div>`;
    }).join("");
  }

  function renderGroupTeachers(groupId) {
    const el = document.getElementById("groupTeachersList");
    if (!el) return;
    const items = (state.teachers || []).filter((t) => (t.groups || []).some((g) => g.id === groupId));
    if (!items.length) { el.innerHTML = '<p class="emptyState">No hay docentes asignados a este grupo todavía.</p>'; return; }
    el.innerHTML = items.map((t) => {
      const subjects = t.subjects?.length
        ? t.subjects.map((s) => `<span class="chip">${escHtml(s)}</span>`).join("")
        : '<span class="teacherMeta">Sin materias</span>';
      const groupEntry = (t.groups || []).find((g) => g.id === groupId);
      const tutorBadge = groupEntry?.is_tutor ? ' <span class="chip">tutoría</span>' : "";
      return `
        <article class="teacherCard">
          <div class="teacherTop">
            <div>
              <div class="teacherName">${escHtml(t.display_name || "Docente")}</div>
              <div class="teacherMeta">${escHtml(t.email || "")}</div>
            </div>
          </div>
          <div class="chips">${subjects}${tutorBadge}</div>
        </article>`;
    }).join("");
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  async function loadStudents() {
    const group = state.activeGroupForStudents;
    if (!group) return;
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    try {
      const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students`);
      state.groupStudents = toItems(data, "items");
      renderStudentsList();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo cargar la lista de alumnos.";
    }
  }

  // ── All-students tab ─────────────────────────────────────────────────────

  function studentInitials(s) {
    const words = String(s.display_name || s.email || "?").trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0]?.slice(0, 2).toUpperCase() || "?";
  }

  async function loadAllStudents() {
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    try {
      const data = await fetchJSON("/api/v1/admin/students");
      state.allStudents = data?.items || [];
      updateAlumnosSubtitle(data?.total ?? state.allStudents.length, data?.pending_count ?? 0);
      populateGroupFilter();
      renderAllStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudieron cargar los alumnos.";
    }
  }

  function updateAlumnosSubtitle(total, pending) {
    const el = document.getElementById("alumnosSubtitle");
    if (!el) return;
    const parts = [`${total} alumnos`];
    if (pending > 0) parts.push(`${pending} pendientes`);
    el.textContent = parts.join(" · ");
  }

  function populateGroupFilter() {
    const sel = document.getElementById("alumnosGroupFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todos los grupos</option>';
    const groups = state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);
    groups.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id; opt.textContent = g.name;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  // ── Student group picker (2-step: course → single via) ────────────────────

  let studentPickerStep = 0; // 0=closed, 1=course, 2=via
  let studentPickerCourse = null; // {stage, year, label}
  let selectedGroupId = null;

  const S_STAGE_KEYS  = ["primaria", "eso", "bachiller", "otros"];
  const S_STAGE_LABEL = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato", otros: "Otros" };

  function sInferStage(g) {
    const raw = String(g.level || g.stage || g.name || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (raw.includes("prim")) return "primaria";
    if (raw.includes("eso") || raw.includes("secund")) return "eso";
    if (raw.includes("bach")) return "bachiller";
    return "otros";
  }

  function sInferYear(g) {
    const n = Number(g.year || 0);
    if (Number.isInteger(n) && n >= 1 && n <= 6) return n;
    const m = String(g.course || g.name || "").match(/\b([1-6])[ºo°]?/);
    return m ? Number(m[1]) : 0;
  }

  function sExtractTrack(g) {
    if (g.track) return String(g.track).toUpperCase().trim();
    const norm = String(g.normalized_name || "");
    if (norm.includes("|")) return norm.split("|").at(-1).toUpperCase().trim() || String(g.name || "").split(/\s+/).at(-1).toUpperCase();
    return String(g.name || "").trim().split(/\s+/).at(-1).toUpperCase();
  }

  function sCoursesFromGroups(groups) {
    const seen = new Map();
    for (const g of groups) {
      const stage = sInferStage(g);
      const year  = sInferYear(g);
      if (!year) continue;
      const key = `${stage}|${year}`;
      if (!seen.has(key)) {
        seen.set(key, { stage, year, key, label: `${S_STAGE_LABEL[stage] || stage} ${year}º` });
      }
    }
    return [...seen.values()].sort((a, b) => {
      const si = S_STAGE_KEYS.indexOf(a.stage) - S_STAGE_KEYS.indexOf(b.stage);
      return si !== 0 ? si : a.year - b.year;
    });
  }

  function sGroupLetter(g) {
    const s = sInferStage(g);
    return s === "bachiller" ? "B" : s === "eso" ? "E" : s === "primaria" ? "P" : "?";
  }

  function renderStudentGroupPicker() {
    const el = document.getElementById("studentGroupPicker");
    if (!el) return;
    const groups = state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);
    const sendBtn = document.getElementById("sendInviteStudentBtn");

    if (studentPickerStep === 0) {
      const sel = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
      if (sel) {
        el.innerHTML = `
          <div class="av-assign-item">
            <div class="av-letter">${escHtml(sGroupLetter(sel))}</div>
            <div><div class="av-assign-name">${escHtml(sel.name)}</div></div>
            <button class="av-icon-btn danger" data-clear-student-group type="button" title="Quitar">×</button>
          </div>`;
      } else {
        el.innerHTML = `<button class="av-add-group-btn" data-open-student-picker type="button">Elegir grupo</button>`;
      }
      if (sendBtn) {
        const hasEmail = String(document.getElementById("inviteStudentEmail")?.value || "").includes("@");
        sendBtn.disabled = !(hasEmail && selectedGroupId);
      }
      return;
    }

    if (studentPickerStep === 1) {
      const courses = sCoursesFromGroups(groups);
      if (!courses.length) {
        el.innerHTML = `<div class="av-group-picker">
          <div class="av-group-picker-head"><span class="av-label">Elige el curso</span>
            <button class="av-icon-btn" data-cancel-student-picker type="button">×</button></div>
          <p class="av-no-assign">No hay grupos disponibles.</p></div>`;
        return;
      }
      const byStage = {};
      for (const c of courses) (byStage[c.stage] = byStage[c.stage] || []).push(c);
      const stagesHtml = S_STAGE_KEYS.filter(s => byStage[s]).map(s => {
        const chips = byStage[s].map(c =>
          `<span class="av-subject-chip" data-student-pick-course="${escHtml(c.key)}">${escHtml(c.label)}</span>`
        ).join("");
        return `<div class="av-group-picker-stage"><span class="av-label">${escHtml(S_STAGE_LABEL[s])}</span>
          <div class="av-subject-pick">${chips}</div></div>`;
      }).join("");
      el.innerHTML = `<div class="av-group-picker">
        <div class="av-group-picker-head"><span class="av-label">Elige el curso</span>
          <button class="av-icon-btn" data-cancel-student-picker type="button" title="Cerrar">×</button></div>
        ${stagesHtml}</div>`;
      return;
    }

    if (studentPickerStep === 2 && studentPickerCourse) {
      const vias = groups.filter(g =>
        sInferStage(g) === studentPickerCourse.stage && sInferYear(g) === studentPickerCourse.year
      );
      const chips = vias.map(g =>
        `<span class="av-subject-chip" data-student-pick-via="${escHtml(g.id)}" title="${escHtml(g.name)}">${escHtml(sExtractTrack(g))}</span>`
      ).join("");
      el.innerHTML = `<div class="av-group-picker">
        <div class="av-group-picker-head">
          <span class="av-label">${escHtml(studentPickerCourse.label)} — elige vía</span>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn ghost small" data-student-back-to-step1 type="button">← Curso</button>
            <button class="av-icon-btn" data-cancel-student-picker type="button" title="Cerrar">×</button>
          </div>
        </div>
        <div class="av-subject-pick">${chips}</div>
      </div>`;
    }
  }

  function renderAllStudents() {
    const el = document.getElementById("alumnosList");
    if (!el) return;

    const q = String(document.getElementById("alumnosSearch")?.value || "").toLowerCase().trim();
    const groupId = document.getElementById("alumnosGroupFilter")?.value || "";

    const items = (state.allStudents || []).filter(s => {
      if (groupId && s.group_id !== groupId) return false;
      if (q) {
        const name = String(s.display_name || "").toLowerCase();
        const email = String(s.email || "").toLowerCase();
        const group = String(s.group_name || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !group.includes(q)) return false;
      }
      return true;
    });

    if (!items.length) {
      el.innerHTML = '<p class="emptyState">No hay alumnos que coincidan con la búsqueda.</p>';
      return;
    }

    el.innerHTML = items.map(s => {
      const isPending = s.status === "pending";
      const initials  = studentInitials(s);
      const actionBtn = isPending
        ? `<button class="btn ghost small" data-tab-resend-student="${escHtml(s.id)}" data-tab-group-id="${escHtml(s.group_id)}" type="button">Reenviar</button>`
        : `<button class="btn ghost small" data-tab-revoke-student="${escHtml(s.id)}" data-tab-group-id="${escHtml(s.group_id)}" type="button">Revocar</button>`;
      const badge = isPending
        ? `<span class="av-status pending"><span class="dot"></span>Pendiente</span>`
        : `<span class="av-status ok"><span class="dot"></span>Activo</span>`;

      return `
        <div class="av-st-row${isPending ? " pending" : ""}">
          <div class="av-avatar" style="width:32px;height:32px;font-size:11px">${escHtml(initials)}</div>
          <div>
            <div class="av-cell-name">${escHtml(s.display_name || s.email)}</div>
            <div class="av-cell-sub">${escHtml(s.group_name || "—")}</div>
          </div>
          <div class="av-st-mail">${escHtml(s.email)}</div>
          ${badge}
          ${actionBtn}
        </div>`;
    }).join("");
  }

  async function revokeStudentFromTab(studentId, groupId) {
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    try {
      await fetchJSON(`/api/v1/admin/groups/${groupId}/students/${studentId}`, { method: "DELETE" });
      await loadAllStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo revocar el acceso.";
    }
  }

  async function resendStudentFromTab(studentId, groupId) {
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    const btn = document.querySelector(`[data-tab-resend-student="${studentId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = "Reenviando…"; }
    try {
      await fetchJSON(`/api/v1/admin/groups/${groupId}/students/${studentId}/resend`, { method: "POST" });
      await loadAllStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo reenviar la invitación.";
      if (btn) { btn.disabled = false; btn.textContent = "Reenviar"; }
    }
  }

  async function inviteStudentFromTab() {
    const email   = String(document.getElementById("inviteStudentEmail")?.value || "").trim().toLowerCase();
    const name    = String(document.getElementById("inviteStudentName")?.value || "").trim();
    const errEl   = document.getElementById("alumnosError");
    const btn     = document.getElementById("sendInviteStudentBtn");
    if (errEl) errEl.textContent = "";

    if (!email || !email.includes("@")) { if (errEl) errEl.textContent = "Introduce un email válido."; return; }
    if (!selectedGroupId) { if (errEl) errEl.textContent = "Elige un grupo."; return; }

    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    try {
      await fetchJSON(`/api/v1/admin/groups/${selectedGroupId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, display_name: name || undefined }),
      });
      closeInviteStudentPanel();
      await loadAllStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo crear la invitación.";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Enviar invitación"; }
    }
  }

  function closeInviteStudentPanel() {
    document.getElementById("inviteStudentPanel")?.classList.add("hidden");
    const btn = document.getElementById("showInviteStudentBtn");
    if (btn) btn.textContent = "+ Invitar alumno";
    const emailEl = document.getElementById("inviteStudentEmail");
    const nameEl  = document.getElementById("inviteStudentName");
    if (emailEl) emailEl.value = "";
    if (nameEl)  nameEl.value  = "";
    studentPickerStep = 0;
    studentPickerCourse = null;
    selectedGroupId = null;
    renderStudentGroupPicker();
    const sendBtn = document.getElementById("sendInviteStudentBtn");
    if (sendBtn) sendBtn.disabled = true;
  }

  function refreshInviteStudentBtn() {
    const email = String(document.getElementById("inviteStudentEmail")?.value || "").trim();
    const btn   = document.getElementById("sendInviteStudentBtn");
    if (btn) btn.disabled = !(email.includes("@") && selectedGroupId);
  }

  // ── Fix 4: delete group ───────────────────────────────────────────────────

  async function deleteGroup() {
    const group = state.activeGroupForStudents;
    if (!group) return;
    const activeStudents = (state.groupStudents || []).filter((s) => s.status !== "revoked");
    const warning = activeStudents.length
      ? `\n\n⚠ Este grupo tiene ${activeStudents.length} alumno(s) autorizado(s) que perderán el acceso.`
      : "";
    if (!confirm(`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.${warning}`)) return;

    const btn   = document.getElementById("deleteGroupBtn");
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    if (btn) { btn.disabled = true; btn.textContent = "Eliminando…"; }

    try {
      await fetchJSON(`/api/v1/admin/groups/${group.id}`, { method: "DELETE" });
      state.activeGroupForStudents = null;
      state.groupStudents = [];
      if (state.adminGroups) {
        state.adminGroups = state.adminGroups.filter((g) => g.id !== group.id);
      }
      gruposGoTo(1);
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo eliminar el grupo.";
      if (btn) { btn.disabled = false; btn.textContent = "Eliminar grupo"; }
    }
  }

  // ── Open level 4 ─────────────────────────────────────────────────────────

  async function openStudentsForGroup(groupId, groupName, groupHint, { reloadTeachers, teachersLoaded }) {
    state.activeGroupForStudents = { id: groupId, name: groupName, hint: groupHint };

    document.getElementById("gruposGroupTitle").textContent = groupName;
    document.getElementById("addStudentEmail").value        = "";
    document.getElementById("importEmailsText").value       = "";
    document.getElementById("importForm")?.classList.add("hidden");
    const toggleImportBtn = document.getElementById("toggleImportBtn");
    if (toggleImportBtn) toggleImportBtn.textContent = "Importar lista";
    const alumnosErr = document.getElementById("alumnosError");
    if (alumnosErr) alumnosErr.textContent = "";
    document.getElementById("groupTeachersList").innerHTML = '<p class="emptyState">Cargando docentes…</p>';

    // Resetear botón eliminar (puede quedar en "Eliminando…" de navegación previa)
    const deleteBtn = document.getElementById("deleteGroupBtn");
    if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = "Eliminar grupo"; }

    // Navegar a nivel 4
    state.gruposLevel = 4;
    renderGrupos();
    document.getElementById("sectionGrupos")?.scrollIntoView({ behavior: "smooth", block: "start" });

    // Cargar docentes y alumnos en paralelo (NO regenerar código automáticamente)
    await Promise.all([
      (async () => {
        if (!teachersLoaded()) await reloadTeachers();
        renderGroupTeachers(groupId);
      })(),
      loadStudents(),
    ]);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function addStudent() {
    const email = String(document.getElementById("addStudentEmail")?.value || "").trim().toLowerCase();
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    if (!email || !email.includes("@")) { if (errEl) errEl.textContent = "Introduce un email válido."; return; }

    const group = state.activeGroupForStudents;
    if (!group) return;

    const btn = document.getElementById("addStudentBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Autorizando…"; }

    try {
      const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      document.getElementById("addStudentEmail").value = "";
      // Store invite URL for "Copiar enlace" button (only available right after POST)
      const inviteId = data?.invite?.id;
      const inviteUrl = data?.invite?.invite_url;
      if (inviteId && inviteUrl) pendingStudentInviteUrls.set(inviteId, inviteUrl);

      const emailSent = data?.email_sent !== false;
      if (errEl) {
        errEl.textContent = emailSent
          ? `✓ Invitación enviada a ${email}`
          : `✓ Invitación creada para ${email} (email no enviado — usa "Copiar enlace")`;
        errEl.style.color = "var(--brand)";
        setTimeout(() => { if (errEl) { errEl.textContent = ""; errEl.style.color = ""; } }, 5000);
      }
      await loadStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo invitar al alumno.";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Invitar alumno"; }
    }
  }

  async function importStudents() {
    const raw   = String(document.getElementById("importEmailsText")?.value || "");
    const errEl = document.getElementById("importError");
    if (errEl) errEl.textContent = "";

    const emails = raw.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes("@") && s.includes("."));
    if (!emails.length) { if (errEl) errEl.textContent = "No se encontraron emails válidos en el texto pegado."; return; }

    const group = state.activeGroupForStudents;
    if (!group) return;

    const btn = document.getElementById("importStudentsBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Importando…"; }

    try {
      const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      document.getElementById("importEmailsText").value = "";
      document.getElementById("importForm")?.classList.add("hidden");
      document.getElementById("toggleImportBtn").textContent = "Importar lista";
      const alumnosErr = document.getElementById("alumnosError");
      if (alumnosErr) alumnosErr.textContent = `✓ ${data.imported ?? emails.length} email(s) importados correctamente.`;
      await loadStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo importar la lista.";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Importar"; }
    }
  }

  async function revokeStudent(studentId) {
    const group = state.activeGroupForStudents;
    if (!group) return;
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    try {
      await fetchJSON(`/api/v1/admin/groups/${group.id}/students/${studentId}`, { method: "DELETE" });
      pendingStudentInviteUrls.delete(studentId);
      await loadStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo revocar el acceso.";
    }
  }

  async function resendStudentInvite(studentId) {
    const group = state.activeGroupForStudents;
    if (!group) return;
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    const btn = document.querySelector(`[data-resend-student="${studentId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = "Reenviando…"; }
    try {
      const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students/${studentId}/resend`, { method: "POST" });
      const inviteUrl = data?.invite?.invite_url;
      if (inviteUrl) pendingStudentInviteUrls.set(studentId, inviteUrl);
      const emailSent = data?.email_sent !== false;
      if (errEl) {
        errEl.textContent = emailSent ? "✓ Invitación reenviada" : "✓ Enlace regenerado (email no enviado — usa Copiar enlace)";
        errEl.style.color = "var(--brand)";
        setTimeout(() => { if (errEl) { errEl.textContent = ""; errEl.style.color = ""; } }, 4000);
      }
      renderStudentsList();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo reenviar la invitación.";
      if (btn) { btn.disabled = false; btn.textContent = "Reenviar"; }
    }
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents({ reloadTeachers, teachersLoaded }) {

    // ── New all-students tab events ───────────────────────────────────────
    document.getElementById("showInviteStudentBtn")?.addEventListener("click", () => {
      const panel = document.getElementById("inviteStudentPanel");
      const isOpen = !panel?.classList.contains("hidden");
      if (isOpen) {
        closeInviteStudentPanel();
      } else {
        panel?.classList.remove("hidden");
        document.getElementById("showInviteStudentBtn").textContent = "× Cancelar";
        renderStudentGroupPicker();
        document.getElementById("inviteStudentEmail")?.focus();
      }
    });
    document.getElementById("closeInviteStudentBtn")?.addEventListener("click", closeInviteStudentPanel);
    document.getElementById("cancelInviteStudentBtn")?.addEventListener("click", closeInviteStudentPanel);
    document.getElementById("sendInviteStudentBtn")?.addEventListener("click", () => inviteStudentFromTab().catch(console.error));
    document.getElementById("inviteStudentEmail")?.addEventListener("input", () => { refreshInviteStudentBtn(); });
    document.getElementById("alumnosSearch")?.addEventListener("input", renderAllStudents);
    document.getElementById("alumnosGroupFilter")?.addEventListener("change", renderAllStudents);

    // Group picker delegation on the form panel
    document.getElementById("inviteStudentPanel")?.addEventListener("click", ev => {
      // Open picker
      if (ev.target.closest("[data-open-student-picker]")) {
        studentPickerStep = 1; renderStudentGroupPicker(); return;
      }
      // Step 1: course chip
      const courseChip = ev.target.closest("[data-student-pick-course]");
      if (courseChip) {
        const [stage, yearStr] = courseChip.dataset.studentPickCourse.split("|");
        studentPickerCourse = { stage, year: Number(yearStr), label: `${S_STAGE_LABEL[stage] || stage} ${yearStr}º` };
        studentPickerStep = 2; renderStudentGroupPicker(); return;
      }
      // Step 2: via chip (single selection → immediate confirm)
      const viaChip = ev.target.closest("[data-student-pick-via]");
      if (viaChip) {
        selectedGroupId = viaChip.dataset.studentPickVia;
        studentPickerStep = 0; studentPickerCourse = null;
        renderStudentGroupPicker(); refreshInviteStudentBtn(); return;
      }
      // Back to step 1
      if (ev.target.closest("[data-student-back-to-step1]")) {
        studentPickerStep = 1; studentPickerCourse = null; renderStudentGroupPicker(); return;
      }
      // Cancel picker
      if (ev.target.closest("[data-cancel-student-picker]")) {
        studentPickerStep = 0; studentPickerCourse = null; renderStudentGroupPicker(); return;
      }
      // Clear selected group
      if (ev.target.closest("[data-clear-student-group]")) {
        selectedGroupId = null; renderStudentGroupPicker(); refreshInviteStudentBtn(); return;
      }
    });

    document.getElementById("alumnosList")?.addEventListener("click", ev => {
      const revokeBtn = ev.target.closest("[data-tab-revoke-student]");
      if (revokeBtn) {
        revokeStudentFromTab(revokeBtn.dataset.tabRevokeStudent, revokeBtn.dataset.tabGroupId).catch(console.error);
        return;
      }
      const resendBtn = ev.target.closest("[data-tab-resend-student]");
      if (resendBtn) {
        resendStudentFromTab(resendBtn.dataset.tabResendStudent, resendBtn.dataset.tabGroupId).catch(console.error);
        return;
      }
    });

    // ── Existing group-level events ────────────────────────────────────────
    document.getElementById("addStudentBtn")?.addEventListener("click", () => addStudent().catch(console.error));
    document.getElementById("addStudentEmail")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addStudent().catch(console.error);
    });

    document.getElementById("toggleImportBtn")?.addEventListener("click", () => {
      const form = document.getElementById("importForm");
      const btn  = document.getElementById("toggleImportBtn");
      const isHidden = form?.classList.contains("hidden");
      form?.classList.toggle("hidden", !isHidden);
      if (btn) btn.textContent = isHidden ? "✕ Cancelar importación" : "Importar lista";
      if (isHidden) document.getElementById("importEmailsText")?.focus();
    });

    document.getElementById("cancelImportBtn")?.addEventListener("click", () => {
      document.getElementById("importForm")?.classList.add("hidden");
      document.getElementById("toggleImportBtn").textContent = "Importar lista";
      document.getElementById("importError").textContent = "";
    });

    document.getElementById("importStudentsBtn")?.addEventListener("click", () => importStudents().catch(console.error));

    document.getElementById("studentsList")?.addEventListener("click", (ev) => {
      const revokeBtn = ev.target.closest("[data-revoke-student]");
      if (revokeBtn) { revokeStudent(revokeBtn.dataset.revokeStudent).catch(console.error); return; }

      const resendBtn = ev.target.closest("[data-resend-student]");
      if (resendBtn) { resendStudentInvite(resendBtn.dataset.resendStudent).catch(console.error); return; }

      const copyBtn = ev.target.closest("[data-copy-student-link]");
      if (copyBtn) {
        const url = pendingStudentInviteUrls.get(copyBtn.dataset.copyStudentLink);
        if (url) {
          copyToClipboard(url, null).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "✓ Copiado";
            setTimeout(() => { copyBtn.textContent = orig; }, 2000);
          });
        }
      }
    });

    document.getElementById("deleteGroupBtn")?.addEventListener("click", () => deleteGroup().catch(console.error));

    return {
      openStudentsForGroup: (id, name, hint) => openStudentsForGroup(id, name, hint, { reloadTeachers, teachersLoaded }),
    };
  }

  return { loadStudents, loadAllStudents, wireEvents };
}
