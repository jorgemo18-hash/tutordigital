export function initAdminTabs({ loadSection, state, onLeave = {}, onReactivate = {} }) {
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
    const d = state.dashboardData || {};
    s("metricGrupos",          d.groups_count        ?? state.adminGroups?.length ?? "—");
    s("metricStudentsActive",  d.students_active      ?? "—");
    s("metricProfesores",      d.teachers_count       ?? state.teachers?.length   ?? "—");
    s("metricStudentsPending", d.students_pending     ?? "—");
    s("gruposTabCount",        state.adminGroups?.length || "");
    s("profTabCount",          state.teachers?.length    || "");
  }

  async function activateTab(tabId) {
    const isSameTab = current === tabId;
    if (!isSameTab) {
      onLeave[current]?.();
      current = tabId;
    }
    window.scrollTo(0, 0);
    document.querySelectorAll(".av-tab[data-tab]").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === tabId));
    Object.entries(panes).forEach(([id, pane]) =>
      pane?.classList.toggle("hidden", id !== tabId));

    if (!loaded.has(tabId)) {
      loaded.add(tabId);
      const key = tabId === "profesores" ? "docentes" : tabId;
      await loadSection(key).catch(console.error);
    } else if (isSameTab) {
      onReactivate[tabId]?.();
    }

    if (tabId === "dashboard") refreshMetrics();
  }

  document.querySelectorAll(".av-tab[data-tab]").forEach(b =>
    b.addEventListener("click", () => activateTab(b.dataset.tab)));
  document.querySelectorAll("[data-goto-tab]").forEach(b =>
    b.addEventListener("click", () => activateTab(b.dataset.gotoTab)));

  return { activateTab, refreshMetrics };
}
