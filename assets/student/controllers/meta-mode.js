// assets/student/controllers/meta-mode.js

export function createMetaMode({ onLogout, onFinished, onTerminado, onShowHistorial, tenantType = "" } = {}) {
  const agendaView       = document.getElementById("agendaView");
  const chatPanel        = document.getElementById("chatPanel");
  const sidebar          = document.getElementById("tdSidebar");
  const activeTaskNameEl = document.getElementById("activeTaskName");
  const btnBackToAgenda  = document.getElementById("btnBackToAgenda");
  const btnSideAgenda    = document.getElementById("btnSideAgenda");
  const btnSideTutor     = document.getElementById("btnSideTutor");
  const btnSideLogout    = document.getElementById("btnSideLogout");
  const btnSideHistorial = document.getElementById("btnSideHistorial");
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
  let _currentTipo = "";

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

  function showTutor(taskTitle = "", studentName = "", tipo = "") {
    _currentTipo = tipo;
    agendaView?.classList.add("v-hidden");
    chatPanel?.classList.remove("v-hidden");
    sidebar?.classList.add("tutor-mode");
    btnSideAgenda?.classList.remove("active");
    btnSideTutor?.classList.add("active");
    if (activeTaskNameEl) activeTaskNameEl.textContent = taskTitle || "";
    _startSessionTimer();
    _resetTerminadoUI();
  }

  // ── "He terminado" / "He entregado" — oculto en exámenes ──
  function _resetTerminadoUI() {
    if (_currentTipo === "exam") {
      btnTerminado?.classList.add("v-hidden");
    } else {
      btnTerminado?.classList.remove("v-hidden");
      if (btnTerminado) {
        btnTerminado.textContent = _currentTipo === "work" ? "He entregado" : "He terminado";
      }
    }
    terminadoChoices?.classList.add("v-hidden");
  }

  btnTerminado?.addEventListener("click", async () => {
    if (_currentTipo === "work") {
      // Trabajo entregado: acción directa, sin segundo paso ni seguimosPanel.
      // Navegar a agenda primero y luego ejecutar el callback de cierre.
      _resetTerminadoUI();
      showAgenda();
      try { await onFinished?.("resolved"); } catch (err) {
        console.error("[meta-mode] btnTerminado(work) error:", err);
      }
      return;
    }
    // Homework / otros: mostrar confirmación antes del overlay
    btnTerminado.classList.add("v-hidden");
    terminadoChoices?.classList.remove("v-hidden");
  });

  btnResuelto?.addEventListener("click", async () => {
    _resetTerminadoUI();
    if (typeof onTerminado === "function") {
      try { await onTerminado("resolved"); } catch (err) {
        console.error("[meta-mode] onTerminado(resolved) error:", err);
      }
    } else {
      showAgenda();
      try { await onFinished?.("resolved"); } catch (err) {
        console.error("[meta-mode] btnResuelto error:", err);
      }
    }
  });

  btnNoPude?.addEventListener("click", async () => {
    _resetTerminadoUI();
    if (typeof onTerminado === "function") {
      try { await onTerminado("stuck"); } catch (err) {
        console.error("[meta-mode] onTerminado(stuck) error:", err);
      }
    } else {
      try { await onFinished?.("stuck"); } catch (err) {
        console.error("[meta-mode] btnNoPude error:", err);
      }
    }
  });

  // ── Navigation ──
  btnBackToAgenda?.addEventListener("click", () => showAgenda());
  btnSideAgenda?.addEventListener("click", () => showAgenda());
  btnCtxBack?.addEventListener("click", () => showAgenda());
  btnSideTutor?.addEventListener("click", () => {}); // already in tutor, no-op
  btnSideHistorial?.addEventListener("click", () => onShowHistorial?.());

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

  // Alumno de academia: arranca directo en el tutor, sin pasar por la
  // agenda, y sin Agenda en el menú lateral (el resto del menú — Tutor,
  // Historial, herramientas — sigue igual; btnSideAgenda solo pierde
  // visibilidad, conserva su listener de click). Cualquier otro tipo de
  // tenant mantiene el comportamiento actual.
  // hidden a secas no basta: .td-sidebar-item fija display:flex en el
  // CSS de autor, que siempre gana al display:none del user-agent
  // stylesheet para [hidden] — hace falta el inline style también.
  if (tenantType === "academia") {
    btnSideAgenda?.setAttribute("hidden", "hidden");
    if (btnSideAgenda) btnSideAgenda.style.display = "none";
    showTutor();
  } else {
    showAgenda();
  }
  return { showAgenda, showTutor, getSessionSeconds: () => _sessionSecs, resetTerminadoUI: _resetTerminadoUI, resetTimer: _startSessionTimer };
}
