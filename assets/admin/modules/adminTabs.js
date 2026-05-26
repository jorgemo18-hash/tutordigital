export function initAdminTabs({ loadSection, state, onLeave = {} }) {
  const panes = {
    dashboard:  document.getElementById("tabDashboard"),
    grupos:     document.getElementById("tabGrupos"),
    profesores: document.getElementById("tabProfesores"),
    alumnos:    document.getElementById("tabAlumnos"),
  };
  const loaded = new Set(["dashboard"]);
  let current = "dashboard";

  function refreshMetrics() {
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v ?? "—"); };
    s("metricGrupos",    state.adminGroups?.length ?? "—");
    s("metricProfesores", state.teachers?.length ?? "—");
    const pending = (state.teachers || []).filter(t => t.invite?.status === "pending").length;
    s("metricProfPending", pending || "—");
    s("gruposTabCount",  state.adminGroups?.length || "");
    s("profTabCount",    state.teachers?.length    || "");
  }

  async function activateTab(tabId) {
    if (current !== tabId) {
      onLeave[current]?.();
      current = tabId;
    }
    document.querySelectorAll(".av-tab[data-tab]").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === tabId));
    Object.entries(panes).forEach(([id, pane]) =>
      pane?.classList.toggle("hidden", id !== tabId));

    if (!loaded.has(tabId)) {
      loaded.add(tabId);
      const key = tabId === "profesores" ? "docentes" : tabId;
      await loadSection(key).catch(console.error);
    }

    if (tabId === "dashboard") refreshMetrics();
  }

  document.querySelectorAll(".av-tab[data-tab]").forEach(b =>
    b.addEventListener("click", () => activateTab(b.dataset.tab)));
  document.querySelectorAll("[data-goto-tab]").forEach(b =>
    b.addEventListener("click", () => activateTab(b.dataset.gotoTab)));

  return { activateTab, refreshMetrics };
}
