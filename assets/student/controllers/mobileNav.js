// Mobile bottom tab bar and profile view controller.
// Only meaningful at ≤768px — wiring is safe at all widths.

export function initMobileNav({ activeUser, showAgenda, onLogout }) {
  const tabBar      = document.getElementById("tdTabBar");
  if (!tabBar) return;

  const profileView  = document.getElementById("profileView");
  const agendaView   = document.getElementById("agendaView");
  const chatPanel    = document.getElementById("chatPanel");
  const btnTabAgenda  = document.getElementById("tabBtnAgenda");
  const btnTabTutor   = document.getElementById("tabBtnTutor");
  const btnTabProfile = document.getElementById("tabBtnProfile");

  let tutorAvailable = false;

  // ── Tab state ────────────────────────────────────────────────────

  function setActiveTab(tab) {
    btnTabAgenda?.classList.toggle("is-active",  tab === "agenda");
    btnTabTutor?.classList.toggle("is-active",   tab === "tutor");
    btnTabProfile?.classList.toggle("is-active", tab === "profile");
  }

  function setTutorAvailable(available) {
    tutorAvailable = available;
    if (btnTabTutor) btnTabTutor.setAttribute("aria-disabled", available ? "false" : "true");
  }

  // ── View transitions ─────────────────────────────────────────────

  function goAgenda() {
    profileView?.classList.add("v-hidden");
    showAgenda(); // delegates to metaMode.showAgenda — handles agendaView + chatPanel
    setActiveTab("agenda");
  }

  function goTutor() {
    if (!tutorAvailable) return;
    profileView?.classList.add("v-hidden");
    agendaView?.classList.add("v-hidden");
    chatPanel?.classList.remove("v-hidden");
    setActiveTab("tutor");
  }

  function goProfile() {
    agendaView?.classList.add("v-hidden");
    chatPanel?.classList.add("v-hidden");
    profileView?.classList.remove("v-hidden");
    setActiveTab("profile");
  }

  // ── Sync active tab when metaMode transitions externally ─────────
  // (e.g. tapping a task card calls showTutor, pressing ← Agenda calls showAgenda)

  if (chatPanel) {
    const observer = new MutationObserver(() => {
      const tutorVisible = !chatPanel.classList.contains("v-hidden");
      if (tutorVisible) {
        setTutorAvailable(true);
        profileView?.classList.add("v-hidden");
        setActiveTab("tutor");
      } else if (!agendaView?.classList.contains("v-hidden")) {
        // showAgenda was called externally (not goProfile)
        setActiveTab("agenda");
      }
      // if both hidden: profile tab is active — no-op
    });
    observer.observe(chatPanel, { attributeFilter: ["class"] });
  }

  // ── Tab click handlers ───────────────────────────────────────────

  btnTabAgenda?.addEventListener("click",  goAgenda);
  btnTabTutor?.addEventListener("click",   goTutor);
  btnTabProfile?.addEventListener("click", goProfile);

  // ── Profile: theme toggle (delegates to sidebar button logic) ────

  document.getElementById("profileThemeToggle")?.addEventListener("click", () => {
    document.getElementById("themeToggle")?.click();
  });

  // ── Profile: logout ──────────────────────────────────────────────

  document.getElementById("profileLogout")?.addEventListener("click", onLogout);

  // ── Profile: populate fields ─────────────────────────────────────

  const name    = activeUser?.displayName || "Alumno";
  const group   = activeUser?.groupName   || "";
  const words   = name.trim().split(/\s+/);
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
