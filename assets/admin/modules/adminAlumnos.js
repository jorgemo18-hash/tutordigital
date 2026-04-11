import { escHtml, fetchJSON, toItems } from "./adminUtils.js";

// ── Init ───────────────────────────────────────────────────────────────────

export function initAlumnosSection({ state, gruposGoTo, renderGrupos }) {

  function studentStatusLabel(status) {
    if (status === "pending") return "pendiente";
    if (status === "used")    return "registrado";
    if (status === "revoked") return "revocado";
    return String(status || "");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderStudentsList() {
    const el = document.getElementById("studentsList");
    if (!el) return;
    const students = (state.groupStudents || []).filter((s) => s.status !== "revoked");
    if (!students.length) { el.innerHTML = '<p class="emptyState">No hay emails autorizados para este grupo todavía.</p>'; return; }
    el.innerHTML = students.map((s) => {
      const canRevoke = s.status === "pending" || s.status === "used";
      return `
        <div class="studentRow">
          <span class="studentEmail">${escHtml(s.email)}</span>
          <span class="statusBadge status-${s.status}">${studentStatusLabel(s.status)}</span>
          ${canRevoke
            ? `<button class="btn ghost small" data-revoke-student="${s.id}">Revocar</button>`
            : `<span></span>`}
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

  // ── Fix 3: code display helpers ───────────────────────────────────────────

  function updateHintDisplay(hint) {
    const hintEl = document.getElementById("groupDetailCodeHint");
    if (hintEl) hintEl.textContent = hint ? `${hint}-????` : "Sin código";
  }

  function showFullCode(joinCode) {
    const box     = document.getElementById("codeResultBox");
    const display = document.getElementById("codeDisplay");
    const feedback = document.getElementById("codeCopyFeedback");
    if (display) display.textContent = joinCode;
    if (feedback) feedback.textContent = "";
    box?.classList.remove("hidden");
    box?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function regenerateCode() {
    const group = state.activeGroupForStudents;
    if (!group) return;
    const btn = document.getElementById("groupDetailRegenBtn");
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    if (btn) { btn.disabled = true; btn.textContent = "Generando…"; }
    try {
      const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/regenerate-code`, { method: "POST" });
      const newHint  = data?.group?.join_code_hint || "";
      const joinCode = data?.join_code || "";
      state.activeGroupForStudents = { ...group, hint: newHint };
      updateHintDisplay(newHint);
      if (joinCode) showFullCode(joinCode);
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo regenerar el código.";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "↺ Nuevo código"; }
    }
  }

  async function copyHintToClipboard() {
    const group = state.activeGroupForStudents;
    const hint  = group?.hint;
    if (!hint) return;
    const btn = document.getElementById("groupDetailCopyBtn");
    try {
      await navigator.clipboard.writeText(`${hint}-????`);
      if (btn) { const orig = btn.textContent; btn.textContent = "¡Copiado!"; setTimeout(() => { btn.textContent = orig; }, 1500); }
    } catch {
      if (btn) btn.textContent = "Error";
    }
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

    const btn = document.getElementById("deleteGroupBtn");
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    if (btn) { btn.disabled = true; btn.textContent = "Eliminando…"; }

    try {
      await fetchJSON(`/api/v1/admin/groups/${group.id}`, { method: "DELETE" });
      state.activeGroupForStudents = null;
      state.groupStudents = [];
      // Remove from local groups list so level 1 doesn't show stale data
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
    updateHintDisplay(groupHint);

    // Navigate to level 4
    state.gruposLevel = 4;
    renderGrupos();

    document.getElementById("sectionGrupos")?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (!teachersLoaded()) await reloadTeachers();
    renderGroupTeachers(groupId);
    await loadStudents();
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
      await fetchJSON(`/api/v1/admin/groups/${group.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      document.getElementById("addStudentEmail").value = "";
      await loadStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo autorizar el email.";
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
      await loadStudents();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo revocar el acceso.";
    }
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents({ reloadTeachers, teachersLoaded }) {
    document.getElementById("gruposBackBtn")?.addEventListener("click", () => {
      state.activeGroupForStudents = null;
      gruposGoTo(3);
    });

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
      const btn = ev.target.closest("[data-revoke-student]");
      if (btn) revokeStudent(btn.dataset.revokeStudent).catch(console.error);
    });

    // Fix 3: regenerate + copy code in group detail
    document.getElementById("groupDetailRegenBtn")?.addEventListener("click", () => regenerateCode().catch(console.error));
    document.getElementById("groupDetailCopyBtn")?.addEventListener("click", () => copyHintToClipboard().catch(console.error));

    // Fix 4: delete group
    document.getElementById("deleteGroupBtn")?.addEventListener("click", () => deleteGroup().catch(console.error));

    return {
      openStudentsForGroup: (id, name, hint) => openStudentsForGroup(id, name, hint, { reloadTeachers, teachersLoaded }),
    };
  }

  return { loadStudents, wireEvents };
}
