// assets/student/controllers/meta-mode.js

export function createMetaMode({ onLogout, onFinished, onTerminado } = {}) {
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

  let _timerInterval = null;
  let _sessionSecs = 0;

  // ── Timer ──
  function _startSessionTimer() {
    clearInterval(_timerInterval);
    _sessionSecs = 0;
    if (timerEl) timerEl.textContent = "00:00";
    _timerInterval = setInterval(() => {
      _sessionSecs++;
      const m = String(Math.floor(_sessionSecs / 60)).padStart(2, "0");
      const s = String(_sessionSecs % 60).padStart(2, "0");
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

  btnTerminado?.addEventListener("click", async () => {
    btnTerminado.classList.add("v-hidden");
    if (typeof onTerminado === "function") {
      try { await onTerminado(); } catch (err) {
        console.error("[meta-mode] onTerminado error:", err);
      }
    } else {
      // Fallback: comportamiento anterior
      terminadoChoices?.classList.remove("v-hidden");
    }
  });

  // Botones del fallback (nunca se usan si onTerminado está cablerdo)
  btnResuelto?.addEventListener("click", async () => {
    _resetTerminadoUI();
    showAgenda();
    try { await onFinished?.("resolved"); } catch (err) {
      console.error("[meta-mode] btnResuelto error:", err);
    }
  });

  btnNoPude?.addEventListener("click", async () => {
    _resetTerminadoUI();
    try { await onFinished?.("stuck"); } catch (err) {
      console.error("[meta-mode] btnNoPude error:", err);
    }
  });

  // ── Navigation ──
  btnBackToAgenda?.addEventListener("click", () => showAgenda());
  btnSideAgenda?.addEventListener("click", () => showAgenda());
  btnCtxBack?.addEventListener("click", () => showAgenda());
  btnSideTutor?.addEventListener("click", () => {}); // already in tutor, no-op

  // ── Logout ──
  async function doLogout() {
    try { await onLogout?.(); } catch {}
    window.location.href = "/login";
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
  return { showAgenda, showTutor, getSessionSeconds: () => _sessionSecs, resetTerminadoUI: _resetTerminadoUI };
}
