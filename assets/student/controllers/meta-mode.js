// assets/student/controllers/meta-mode.js

export function createMetaMode({ onLogout, onFinished } = {}) {
  const agendaView       = document.getElementById("agendaView");
  const chatPanel        = document.getElementById("chatPanel");
  const sidebar          = document.getElementById("tdSidebar");
  const activeTaskNameEl = document.getElementById("activeTaskName");
  const btnBackToAgenda  = document.getElementById("btnBackToAgenda");
  const btnSideAgenda    = document.getElementById("btnSideAgenda");
  const btnSideTutor     = document.getElementById("btnSideTutor");
  const btnSideLogout    = document.getElementById("btnSideLogout");
  const btnAvatarMenuLogout = document.getElementById("btnAvatarMenuLogout");
  const btnTerminado     = document.getElementById("btnTerminado");
  const terminadoChoices = document.getElementById("terminadoChoices");
  const btnResuelto      = document.getElementById("btnResuelto");
  const btnNoPude        = document.getElementById("btnNoPude");
  const btnCtxBack       = document.getElementById("btnCtxBack");
  const timerEl          = document.getElementById("tutorSessionTimer");
  const btnAvatarToggle  = document.getElementById("btnAvatarToggle");
  const avatarMenu       = document.getElementById("avatarMenu");
  const btnSidePizarra   = document.getElementById("btnSidePizarra");
  const btnTutorPizarra  = document.getElementById("tutorBtnPizarra");
  const btnSideCalc      = document.getElementById("btnSideCalculadora");
  const btnTutorCalc     = document.getElementById("tutorBtnCalc");

  let _timerInterval = null;

  // ── Timer ──
  function _startSessionTimer() {
    clearInterval(_timerInterval);
    let secs = 0;
    if (timerEl) timerEl.textContent = "00:00";
    _timerInterval = setInterval(() => {
      secs++;
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function _stopSessionTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
    if (timerEl) timerEl.textContent = "";
  }

  // ── Views ──
  function showAgenda() {
    agendaView?.classList.remove("v-hidden");
    chatPanel?.classList.add("v-hidden");
    sidebar?.classList.remove("tutor-mode");
    btnSideAgenda?.classList.add("active");
    btnSideTutor?.classList.remove("active");
    _stopSessionTimer();
    _resetTerminadoUI();
  }

  function showTutor(taskTitle = "", studentName = "") {
    agendaView?.classList.add("v-hidden");
    chatPanel?.classList.remove("v-hidden");
    sidebar?.classList.add("tutor-mode");
    btnSideAgenda?.classList.remove("active");
    btnSideTutor?.classList.add("active");
    if (activeTaskNameEl) activeTaskNameEl.textContent = taskTitle || "";
    _startSessionTimer();
    _resetTerminadoUI();
  }

  // ── "He terminado" ──
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
  });

  // ── Navigation ──
  btnBackToAgenda?.addEventListener("click", () => showAgenda());
  btnSideAgenda?.addEventListener("click", () => showAgenda());
  btnCtxBack?.addEventListener("click", () => showAgenda());
  btnSideTutor?.addEventListener("click", () => {}); // already in tutor, no-op

  // ── Tools: pizarra ──
  function openPizarra() {
    document.getElementById("boardOverlay")?.classList.add("open");
  }
  btnSidePizarra?.addEventListener("click", openPizarra);
  btnTutorPizarra?.addEventListener("click", openPizarra);

  // Calculadora: toggle #pad visibility (the scientific keyboard)
  function toggleCalc() {
    const pad = document.getElementById("pad");
    if (!pad) return;
    pad.style.display = (pad.style.display === "none" || pad.style.display === "") ? "grid" : "none";
  }
  btnSideCalc?.addEventListener("click", toggleCalc);
  btnTutorCalc?.addEventListener("click", toggleCalc);

  // ── Logout ──
  async function doLogout() {
    try { await onLogout?.(); } catch {}
    window.location.href = "/index.html";
  }
  btnSideLogout?.addEventListener("click", doLogout);
  btnAvatarMenuLogout?.addEventListener("click", doLogout);

  // ── Avatar dropdown ──
  btnAvatarToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarMenu?.classList.toggle("open");
  });
  document.addEventListener("click", () => avatarMenu?.classList.remove("open"));

  showAgenda();
  return { showAgenda, showTutor };
}
