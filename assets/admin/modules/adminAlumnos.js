import { copyToClipboard } from "./adminUtils.js";
import {
  loadStudents, addStudent, revokeStudent, resendStudentInvite,
} from "./alumnos/groupInvites.js";
import { createGroupPicker } from "./alumnos/groupPicker.js";
import { createGroupImport } from "./alumnos/groupImport.js";
import { createUnifiedStudents } from "./alumnos/unifiedStudents.js";
import { createUnifiedStudentsHandlers } from "./alumnos/unifiedStudentsHandlers.js";
import { deleteGroup, openStudentsForGroup } from "./alumnos/groupLifecycle.js";

// Orquestador de la sección Alumnos: crea el estado privado compartido entre
// los submódulos (Map de enlaces de invitación pendientes, el picker de
// grupo, la lista unificada "Alumnos del centro") y conecta los eventos del
// DOM con las funciones de cada submódulo — cada una recibe `state`
// explícito, sin cerrar sobre el scope de este archivo.

export function initAlumnosSection({ state, gruposGoTo, renderGrupos }) {

  const pendingStudentInviteUrls = new Map();
  const groupPicker = createGroupPicker();
  const groupImport = createGroupImport();
  const unifiedStudents = createUnifiedStudents({ pendingInviteUrls: pendingStudentInviteUrls });
  const unifiedStudentsHandlers = createUnifiedStudentsHandlers({
    pendingInviteUrls: pendingStudentInviteUrls,
    unifiedStudents,
  });

  function wireEvents({ reloadTeachers, teachersLoaded }) {

    // ── Vista cross-grupo: invitar alumno ────────────────────────────────
    document.getElementById("showInviteStudentBtn")?.addEventListener("click", () => {
      const isOpen = !document.getElementById("inviteStudentPanel")?.classList.contains("hidden");
      if (isOpen) groupPicker.closePanel(state);
      else groupPicker.openPanel(state);
    });
    document.getElementById("closeInviteStudentBtn")?.addEventListener("click", () => groupPicker.closePanel(state));
    document.getElementById("cancelInviteStudentBtn")?.addEventListener("click", () => groupPicker.closePanel(state));
    document.getElementById("sendInviteStudentBtn")?.addEventListener("click", () => {
      groupPicker.inviteFromTab(state, { onDone: () => unifiedStudents.load(state) }).catch(console.error);
    });
    document.getElementById("inviteStudentEmail")?.addEventListener("input", groupPicker.refreshInviteBtn);
    document.getElementById("inviteStudentFirstName")?.addEventListener("input", groupPicker.refreshInviteBtn);
    document.getElementById("inviteStudentLastName")?.addEventListener("input", groupPicker.refreshInviteBtn);
    document.getElementById("alumnosSearch")?.addEventListener("input", () => unifiedStudents.render(state));
    document.getElementById("alumnosGroupFilter")?.addEventListener("change", () => unifiedStudents.render(state));

    document.getElementById("inviteStudentPanel")?.addEventListener("click", (ev) => {
      groupPicker.handleClick(ev, state);
    });

    // ── Lista unificada "Alumnos del centro" ─────────────────────────────
    document.getElementById("alumnosStatusFilters")?.addEventListener("click", (ev) => {
      const chip = ev.target.closest("[data-status-filter]");
      if (chip) unifiedStudents.setStatusFilter(chip.dataset.statusFilter, state);
    });
    document.getElementById("alumnosList")?.addEventListener("click", (ev) => {
      unifiedStudentsHandlers.handleClick(ev, state).catch(console.error);
    });

    // ── Nivel de grupo (Grupos → grupo → Alumnos) ────────────────────────
    document.getElementById("addStudentBtn")?.addEventListener("click", () => addStudent(state, pendingStudentInviteUrls).catch(console.error));
    document.getElementById("addStudentEmail")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addStudent(state, pendingStudentInviteUrls).catch(console.error);
    });

    document.getElementById("toggleImportBtn")?.addEventListener("click", () => {
      const form = document.getElementById("importForm");
      const btn  = document.getElementById("toggleImportBtn");
      const isHidden = form?.classList.contains("hidden");
      form?.classList.toggle("hidden", !isHidden);
      if (btn) btn.textContent = isHidden ? "✕ Cancelar importación" : "Importar lista";
      if (isHidden) document.getElementById("importFileInput")?.focus();
    });

    document.getElementById("cancelImportBtn")?.addEventListener("click", () => {
      document.getElementById("importForm")?.classList.add("hidden");
      document.getElementById("toggleImportBtn").textContent = "Importar lista";
      document.getElementById("importError").textContent = "";
      groupImport.resetReview();
    });

    document.getElementById("importFileInput")?.addEventListener("change", () => groupImport.handleFileChosen(state).catch(console.error));
    document.getElementById("importReview")?.addEventListener("click", (ev) => {
      groupImport.handleClick(ev, state, { onDone: () => loadStudents(state, pendingStudentInviteUrls) });
    });

    document.getElementById("studentsList")?.addEventListener("click", (ev) => {
      const revokeBtn = ev.target.closest("[data-revoke-student]");
      if (revokeBtn) { revokeStudent(state, revokeBtn.dataset.revokeStudent, pendingStudentInviteUrls).catch(console.error); return; }

      const resendBtn = ev.target.closest("[data-resend-student]");
      if (resendBtn) { resendStudentInvite(state, resendBtn.dataset.resendStudent, pendingStudentInviteUrls).catch(console.error); return; }

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

    document.getElementById("deleteGroupBtn")?.addEventListener("click", () => deleteGroup(state, { gruposGoTo }).catch(console.error));

    return {
      openStudentsForGroup: (id, name, hint) => openStudentsForGroup(state, id, name, hint, {
        reloadTeachers, teachersLoaded, renderGrupos,
        pendingInviteUrls: pendingStudentInviteUrls,
        resetImport: groupImport.resetReview,
      }),
    };
  }

  return {
    loadStudents: () => loadStudents(state, pendingStudentInviteUrls),
    loadUnifiedStudents: () => unifiedStudents.load(state),
    wireEvents,
  };
}
