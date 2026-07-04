import { copyToClipboard } from "./adminUtils.js";
import {
  loadStudents, addStudent, importStudents, revokeStudent, resendStudentInvite,
} from "./alumnos/groupInvites.js";
import { createGroupPicker } from "./alumnos/groupPicker.js";
import {
  loadAllStudents, renderAllStudents, deleteStudentPermanently,
  revokeStudentFromTab, resendStudentFromTab,
} from "./alumnos/allStudentsTab.js";
import { createRegisteredStudents } from "./alumnos/registeredStudents.js";
import { deleteGroup, openStudentsForGroup } from "./alumnos/groupLifecycle.js";

// Orquestador de la sección Alumnos: crea el estado privado compartido entre
// los submódulos (Map de enlaces de invitación pendientes, el picker de
// grupo, la vista de alumnos registrados) y conecta los eventos del DOM con
// las funciones de cada submódulo — cada una recibe `state` explícito, sin
// cerrar sobre el scope de este archivo.

export function initAlumnosSection({ state, gruposGoTo, renderGrupos }) {

  const pendingStudentInviteUrls = new Map();
  const groupPicker = createGroupPicker();
  const registeredStudents = createRegisteredStudents();

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
      groupPicker.inviteFromTab(state, { onDone: () => loadAllStudents(state) }).catch(console.error);
    });
    document.getElementById("inviteStudentEmail")?.addEventListener("input", groupPicker.refreshInviteBtn);
    document.getElementById("inviteStudentFirstName")?.addEventListener("input", groupPicker.refreshInviteBtn);
    document.getElementById("inviteStudentLastName")?.addEventListener("input", groupPicker.refreshInviteBtn);
    document.getElementById("alumnosSearch")?.addEventListener("input", () => renderAllStudents(state));
    document.getElementById("alumnosGroupFilter")?.addEventListener("change", () => renderAllStudents(state));

    document.getElementById("inviteStudentPanel")?.addEventListener("click", (ev) => {
      groupPicker.handleClick(ev, state);
    });

    document.getElementById("alumnosList")?.addEventListener("click", ev => {
      const revokeBtn = ev.target.closest("[data-tab-revoke-student]");
      if (revokeBtn) {
        revokeStudentFromTab(state, revokeBtn.dataset.tabRevokeStudent, revokeBtn.dataset.tabGroupId).catch(console.error);
        return;
      }
      const resendBtn = ev.target.closest("[data-tab-resend-student]");
      if (resendBtn) {
        resendStudentFromTab(state, resendBtn.dataset.tabResendStudent, resendBtn.dataset.tabGroupId).catch(console.error);
        return;
      }
      const deleteBtn = ev.target.closest("[data-tab-delete-student]");
      if (deleteBtn) {
        deleteStudentPermanently(state, deleteBtn.dataset.tabDeleteStudent, deleteBtn.dataset.tabStudentName).catch(console.error);
        return;
      }
    });

    // ── Alumnos registrados (Activos/Archivados) ─────────────────────────
    document.getElementById("registradosTabs")?.addEventListener("click", (ev) => {
      const tabBtn = ev.target.closest("[data-registrados-tab]");
      if (tabBtn) registeredStudents.selectTab(state, tabBtn.dataset.registradosTab);
    });
    document.getElementById("alumnosRegistradosList")?.addEventListener("click", (ev) => {
      const archiveBtn = ev.target.closest("[data-archive-registered-student]");
      if (archiveBtn) {
        registeredStudents.archive(state, archiveBtn.dataset.archiveRegisteredStudent).catch(console.error);
        return;
      }
      const restoreBtn = ev.target.closest("[data-restore-registered-student]");
      if (restoreBtn) {
        registeredStudents.restore(state, restoreBtn.dataset.restoreRegisteredStudent).catch(console.error);
      }
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
      if (isHidden) document.getElementById("importEmailsText")?.focus();
    });

    document.getElementById("cancelImportBtn")?.addEventListener("click", () => {
      document.getElementById("importForm")?.classList.add("hidden");
      document.getElementById("toggleImportBtn").textContent = "Importar lista";
      document.getElementById("importError").textContent = "";
    });

    document.getElementById("importStudentsBtn")?.addEventListener("click", () => importStudents(state, pendingStudentInviteUrls).catch(console.error));

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
        reloadTeachers, teachersLoaded, renderGrupos, pendingInviteUrls: pendingStudentInviteUrls,
      }),
    };
  }

  return {
    loadStudents: () => loadStudents(state, pendingStudentInviteUrls),
    loadAllStudents: () => loadAllStudents(state),
    loadRegisteredStudents: () => registeredStudents.load(state),
    wireEvents,
  };
}
