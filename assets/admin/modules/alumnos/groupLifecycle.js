import { fetchJSON } from "../adminUtils.js";
import { renderGroupTeachers } from "./groupTeachers.js";
import { loadStudents } from "./groupInvites.js";

// Alta/baja de la navegación al nivel 4 (Grupos → grupo → Alumnos) y borrado
// del grupo entero. `pendingInviteUrls` se pasa explícito porque
// openStudentsForGroup dispara loadStudents (groupInvites.js), que lo
// necesita.

export async function deleteGroup(state, { gruposGoTo }) {
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

export async function openStudentsForGroup(
  state,
  groupId, groupName, groupHint,
  { reloadTeachers, teachersLoaded, renderGrupos, pendingInviteUrls }
) {
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
  // — capturado aquí mismo (no en cada call site) para que un fallo de red
  // o de sesión (ver apiFetch/handleUnauthorized) nunca quede como Unhandled
  // Promise Rejection: se pinta en el mismo elemento de error que usa
  // deleteGroup, en vez de reventar sin control.
  try {
    await Promise.all([
      (async () => {
        if (!teachersLoaded()) await reloadTeachers();
        renderGroupTeachers(state, groupId);
      })(),
      loadStudents(state, pendingInviteUrls),
    ]);
  } catch (err) {
    if (alumnosErr) alumnosErr.textContent = err?.message || "No se pudieron cargar los docentes/alumnos del grupo.";
  }
}
