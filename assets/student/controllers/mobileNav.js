// Mobile bottom tab bar and "Más" view controller.
// Also manages browser history (pushState/popstate) for the back-button
// so the native back gesture returns to the agenda instead of exiting the PWA.
// Only meaningful at ≤768px — wiring is safe at all widths.

function isMobileBreakpoint() {
  return window.matchMedia("(max-width: 768px)").matches;
}

export function initMobileNav({ activeUser, showAgenda, onLogout, onShowHistorial }) {
  const tabBar      = document.getElementById("tdTabBar");
  if (!tabBar) return;

  const masView      = document.getElementById("masView");
  const agendaView   = document.getElementById("agendaView");
  const chatPanel    = document.getElementById("chatPanel");
  const btnTabAgenda = document.getElementById("tabBtnAgenda");
  const btnTabTutor  = document.getElementById("tabBtnTutor");
  const btnTabMas    = document.getElementById("tabBtnMas");

  let tutorAvailable  = false;
  let _tutorStateLive = false; // true while a tutor pushState entry is on the stack

  // ── Tab state ────────────────────────────────────────────────────

  function setActiveTab(tab) {
    btnTabAgenda?.classList.toggle("is-active", tab === "agenda");
    btnTabTutor?.classList.toggle("is-active",  tab === "tutor");
    btnTabMas?.classList.toggle("is-active",    tab === "mas");
  }

  function setTutorAvailable(available) {
    tutorAvailable = available;
    if (btnTabTutor) btnTabTutor.setAttribute("aria-disabled", available ? "false" : "true");
  }

  // ── History API ──────────────────────────────────────────────────
  // Push a tutor state entry only once per tutor "session" so that one
  // back-press returns to the agenda without building up a deep stack.

  function _pushTutorState() {
    if (_tutorStateLive || !isMobileBreakpoint()) return;
    try {
      history.pushState({ view: "tutor" }, "");
      _tutorStateLive = true;
    } catch {}
  }

  function _clearTutorState() {
    _tutorStateLive = false;
  }

  window.addEventListener("popstate", (e) => {
    if (!isMobileBreakpoint()) return;
    // Back was pressed; if we were in tutor, go to agenda without reloading
    if (!e.state?.view || e.state.view !== "tutor") {
      _clearTutorState();
      goAgenda();
    }
  });

  // ── View transitions ─────────────────────────────────────────────

  function goAgenda() {
    _clearTutorState();
    masView?.classList.add("v-hidden");
    showAgenda(); // delegates to metaMode.showAgenda — handles agendaView + chatPanel
    setActiveTab("agenda");
  }

  function goTutor() {
    if (!tutorAvailable) return;
    masView?.classList.add("v-hidden");
    agendaView?.classList.add("v-hidden");
    chatPanel?.classList.remove("v-hidden");
    setActiveTab("tutor");
    _pushTutorState();
  }

  function goMas() {
    agendaView?.classList.add("v-hidden");
    chatPanel?.classList.add("v-hidden");
    masView?.classList.remove("v-hidden");
    setActiveTab("mas");
  }

  // ── Sync active tab when metaMode transitions externally ─────────
  // (e.g. tapping a task card calls showTutor, pressing ← Agenda calls showAgenda)

  if (chatPanel) {
    const observer = new MutationObserver(() => {
      const tutorVisible = !chatPanel.classList.contains("v-hidden");
      if (tutorVisible) {
        setTutorAvailable(true);
        masView?.classList.add("v-hidden");
        setActiveTab("tutor");
        document.body.classList.add("mobile-tutor-active");
        _pushTutorState(); // push history entry when tutor becomes visible externally
      } else {
        document.body.classList.remove("mobile-tutor-active");
        _clearTutorState();
        if (!agendaView?.classList.contains("v-hidden")) {
          // showAgenda was called externally (not goMas)
          setActiveTab("agenda");
        }
        // if both hidden: mas tab is active — no-op
      }
    });
    observer.observe(chatPanel, { attributeFilter: ["class"] });
  }

  // ── Tab click handlers ───────────────────────────────────────────

  btnTabAgenda?.addEventListener("click", goAgenda);
  btnTabTutor?.addEventListener("click",  goTutor);
  btnTabMas?.addEventListener("click",    goMas);

  // ── Más: historial ───────────────────────────────────────────────

  document.getElementById("masHistorial")?.addEventListener("click", () => {
    onShowHistorial?.();
  });

  // ── Más: theme toggle (delegates to sidebar button logic) ────────

  document.getElementById("profileThemeToggle")?.addEventListener("click", () => {
    document.getElementById("themeToggle")?.click();
  });

  // ── Más: logout ──────────────────────────────────────────────────
  // Must redirect to /login after clearing the session — same as desktop doLogout().

  async function _doLogout() {
    try { await onLogout?.(); } catch {}
    window.location.href = "/login";
  }

  document.getElementById("profileLogout")?.addEventListener("click", _doLogout);

  // ── Más: populate identity fields ───────────────────────────────

  const name     = activeUser?.displayName || "Alumno";
  const group    = activeUser?.groupName   || "";
  const words    = name.trim().split(/\s+/);
  const initials = words.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "A";

  const elInitials = document.getElementById("profileInitials");
  const elName     = document.getElementById("profileName");
  const elGroup    = document.getElementById("profileGroup");
  if (elInitials) elInitials.textContent = initials;
  if (elName)     elName.textContent     = name;
  if (elGroup) {
    elGroup.textContent = group;
    elGroup.hidden      = !group;
  }
}
