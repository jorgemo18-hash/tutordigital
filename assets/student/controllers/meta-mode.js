// assets/student/controllers/meta-mode.js
// Controls agenda ↔ tutor view switching and "He terminado" flow.

export function createMetaMode({ onLogout, onFinished } = {}) {
  const agendaView    = document.getElementById("agendaView");
  const tutorView     = document.getElementById("chat");
  const tutorTopBar   = document.getElementById("tutorTopBar");
  const tutorFooter   = document.getElementById("tutorFooter");
  const activeTaskNameEl = document.getElementById("activeTaskName");
  const btnBackToAgenda  = document.getElementById("btnBackToAgenda");
  const btnSideAgenda    = document.getElementById("btnSideAgenda");
  const btnSideLogout    = document.getElementById("btnSideLogout");
  const btnTerminado     = document.getElementById("btnTerminado");
  const terminadoChoices = document.getElementById("terminadoChoices");
  const btnResuelto      = document.getElementById("btnResuelto");
  const btnNoPude        = document.getElementById("btnNoPude");

  // ========================
  //  View helpers
  // ========================
  function showAgenda() {
    agendaView?.classList.remove("v-hidden");
    tutorView?.classList.add("v-hidden");
    tutorTopBar?.classList.add("v-hidden");
    tutorFooter?.classList.add("v-hidden");
    btnSideAgenda?.classList.add("sideActive");
    _resetTerminadoUI();
  }

  function showTutor(taskTitle = "") {
    agendaView?.classList.add("v-hidden");
    tutorView?.classList.remove("v-hidden");
    tutorTopBar?.classList.remove("v-hidden");
    tutorFooter?.classList.remove("v-hidden");
    btnSideAgenda?.classList.remove("sideActive");
    if (activeTaskNameEl) activeTaskNameEl.textContent = taskTitle || "";
    _resetTerminadoUI();
  }

  // ========================
  //  "He terminado" flow
  // ========================
  function _resetTerminadoUI() {
    btnTerminado?.classList.remove("v-hidden");
    terminadoChoices?.classList.add("v-hidden");
  }

  btnTerminado?.addEventListener("click", () => {
    btnTerminado.classList.add("v-hidden");
    terminadoChoices?.classList.remove("v-hidden");
  });

  btnResuelto?.addEventListener("click", () => {
    _resetTerminadoUI();
    try { onFinished?.("resolved"); } catch {}
    showAgenda();
  });

  btnNoPude?.addEventListener("click", () => {
    _resetTerminadoUI();
    try { onFinished?.("stuck"); } catch {}
    // Stay in tutor so the student can keep asking
  });

  // ========================
  //  Navigation buttons
  // ========================
  btnBackToAgenda?.addEventListener("click", () => showAgenda());
  btnSideAgenda?.addEventListener("click", () => showAgenda());

  // ========================
  //  Logout
  // ========================
  btnSideLogout?.addEventListener("click", async () => {
    try { await onLogout?.(); } catch {}
    window.location.href = "/index.html";
  });

  // Start in agenda mode
  showAgenda();

  return { showAgenda, showTutor };
}
