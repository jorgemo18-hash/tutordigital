// assets/student/controllers/meta-mode.js
// Controls agenda ↔ tutor view switching and "He terminado" flow.

export function createMetaMode({ onLogout, onFinished } = {}) {
  const agendaView       = document.getElementById("agendaView");
  const chatPanel        = document.getElementById("chatPanel");
  const activeTaskNameEl = document.getElementById("activeTaskName");
  const btnBackToAgenda  = document.getElementById("btnBackToAgenda");
  const btnSideAgenda    = document.getElementById("btnSideAgenda");
  const btnSideLogout    = document.getElementById("btnSideLogout");
  const btnTerminado     = document.getElementById("btnTerminado");
  const terminadoChoices = document.getElementById("terminadoChoices");
  const btnResuelto      = document.getElementById("btnResuelto");
  const btnNoPude        = document.getElementById("btnNoPude");
  const btnCtxBack       = document.getElementById("btnCtxBack");
  const timerEl          = document.getElementById("tutorSessionTimer");
  const greetingNameEl   = document.getElementById("tutorGreetingName");

  let _timerInterval = null;

  // ========================
  //  Session timer
  // ========================
  function _startSessionTimer() {
    clearInterval(_timerInterval);
    let seconds = 0;
    if (timerEl) timerEl.textContent = "00:00";
    _timerInterval = setInterval(() => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, "0");
      const s = String(seconds % 60).padStart(2, "0");
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function _stopSessionTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
    if (timerEl) timerEl.textContent = "";
  }

  // ========================
  //  View helpers
  // ========================
  function showAgenda() {
    agendaView?.classList.remove("v-hidden");
    chatPanel?.classList.add("v-hidden");
    btnSideAgenda?.classList.add("active");
    _stopSessionTimer();
    _resetTerminadoUI();
  }

  function showTutor(taskTitle = "", studentName = "") {
    agendaView?.classList.add("v-hidden");
    chatPanel?.classList.remove("v-hidden");
    btnSideAgenda?.classList.remove("active");
    if (activeTaskNameEl) activeTaskNameEl.textContent = taskTitle || "";
    if (greetingNameEl) {
      const firstName = (studentName || "").split(" ")[0] || "alumno";
      greetingNameEl.textContent = firstName;
    }
    _startSessionTimer();
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
    // stay in tutor while the async handler runs (it calls showAgenda itself)
  });

  // ========================
  //  Navigation buttons
  // ========================
  btnBackToAgenda?.addEventListener("click", () => showAgenda());
  btnSideAgenda?.addEventListener("click", () => showAgenda());
  btnCtxBack?.addEventListener("click", () => showAgenda());

  // ========================
  //  Logout
  // ========================
  btnSideLogout?.addEventListener("click", async () => {
    try { await onLogout?.(); } catch {}
    window.location.href = "/index.html";
  });

  // Avatar dropdown
  const btnAvatarToggle = document.getElementById("btnAvatarToggle");
  const avatarMenu = document.getElementById("avatarMenu");
  btnAvatarToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarMenu?.classList.toggle("open");
  });
  document.addEventListener("click", () => avatarMenu?.classList.remove("open"));

  // Start in agenda mode
  showAgenda();

  return { showAgenda, showTutor };
}
