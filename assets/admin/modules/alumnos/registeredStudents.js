import { escHtml, fetchJSON } from "../adminUtils.js";

// Alumnos ya registrados (cuenta real, tabla students) — Activos/Archivados.
// Distinto de allStudentsTab.js (que gestiona student_invites, es decir,
// invitaciones pendientes/usadas/revocadas, no la cuenta real del alumno).
// Aquí "archivar" desactiva el acceso real del alumno (ver
// admin.students.archivar.routes.js), por eso necesita el id real de
// `students`, que student_invites no tiene.

function studentDisplayName(s) {
  if (s.first_name || s.last_name) return [s.first_name, s.last_name].filter(Boolean).join(" ");
  return s.display_name || "(sin nombre)";
}

function groupNameOf(state, groupId) {
  const groups = state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);
  return groups.find((g) => g.id === groupId)?.name || "—";
}

export function createRegisteredStudents() {
  let activeTab = "activos"; // "activos" | "archivados"
  let items = [];

  function render(state) {
    const el = document.getElementById("alumnosRegistradosList");
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<p class="emptyState">${activeTab === "archivados" ? "No hay alumnos archivados." : "No hay alumnos registrados todavía."}</p>`;
      return;
    }
    el.innerHTML = items.map((s) => {
      const actionBtn = activeTab === "archivados"
        ? `<button class="btn ghost small" data-restore-registered-student="${escHtml(s.id)}" type="button">Restaurar</button>`
        : `<button class="btn ghost small" data-archive-registered-student="${escHtml(s.id)}" type="button" style="color:var(--danger,#e55)">Archivar</button>`;
      return `
        <div class="av-st-row">
          <div><div class="av-cell-name">${escHtml(studentDisplayName(s))}</div>
          <div class="av-cell-sub">${escHtml(groupNameOf(state, s.group_id))}</div></div>
          <div style="display:flex;gap:6px;align-items:center;margin-left:auto">${actionBtn}</div>
        </div>`;
    }).join("");
  }

  function renderTabs() {
    const wrap = document.getElementById("registradosTabs");
    if (!wrap) return;
    wrap.querySelectorAll("[data-registrados-tab]").forEach((btn) => {
      const isActive = btn.dataset.registradosTab === activeTab;
      btn.classList.toggle("primary", isActive);
      btn.classList.toggle("ghost", !isActive);
    });
  }

  async function load(state) {
    const errEl = document.getElementById("alumnosRegistradosError");
    if (errEl) errEl.textContent = "";
    renderTabs();
    try {
      const approvalStatus = activeTab === "archivados" ? "archived" : "approved";
      const data = await fetchJSON(`/api/v1/students?approval_status=${approvalStatus}&limit=500`);
      items = data?.items || [];
      render(state);
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudieron cargar los alumnos registrados.";
    }
  }

  async function archive(state, studentId) {
    const errEl = document.getElementById("alumnosRegistradosError");
    if (errEl) errEl.textContent = "";
    try {
      await fetchJSON(`/api/v1/admin/students/${studentId}/archive`, { method: "DELETE" });
      await load(state);
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo archivar al alumno.";
    }
  }

  async function restore(state, studentId) {
    const errEl = document.getElementById("alumnosRegistradosError");
    if (errEl) errEl.textContent = "";
    try {
      await fetchJSON(`/api/v1/admin/students/${studentId}/restore`, { method: "PUT" });
      await load(state);
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo restaurar al alumno.";
    }
  }

  function selectTab(state, tab) {
    if (tab !== "activos" && tab !== "archivados") return;
    activeTab = tab;
    load(state);
  }

  return { load, archive, restore, selectTab };
}
