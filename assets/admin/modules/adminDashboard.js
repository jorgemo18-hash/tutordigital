// ── Dashboard: métricas y actividad de hoy ──────────────────────────────────
// Extraído literal de admin.js. El loadDashboard() original llamaba a
// tabs.refreshMetrics(), pero `tabs` se crea más tarde en init() (se
// construye pasándole loadSection, que a su vez llama a esto) —
// createDashboardController() rompe ese círculo recibiendo un callback
// `onLoaded` explícito en vez de cerrar sobre `tabs`.

export function renderActivityToday(data) {
  const dateEl = document.getElementById("activityDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long",
    });
  }
  const studentsBox = document.getElementById("activityStudentsBox");
  const teachersBox = document.getElementById("activityTeachersBox");
  const n = data?.activity_today || {};

  if (studentsBox) {
    const count = n.students ?? 0;
    studentsBox.innerHTML = count > 0
      ? `<div class="av-metric-num" style="font-size:36px">${count}</div>
         <div class="av-metric-eye" style="margin-top:6px">Alumnos en el tutor</div>`
      : `<p class="emptyState">Ningún alumno ha abierto el tutor hoy.</p>`;
  }
  if (teachersBox) {
    const count = n.teachers ?? 0;
    teachersBox.innerHTML = count > 0
      ? `<div class="av-metric-num" style="font-size:36px">${count}</div>
         <div class="av-metric-eye" style="margin-top:6px">Profesores en el panel</div>`
      : `<p class="emptyState">Ningún profesor ha accedido hoy.</p>`;
  }
}

export function createDashboardController({ fetchJSON, state }) {
  async function load(onLoaded) {
    try {
      const data = await fetchJSON("/api/v1/admin/dashboard");
      state.dashboardData = data;
      onLoaded?.();
      renderActivityToday(data);
    } catch (err) {
      console.error("[admin] dashboard fetch failed:", err?.message);
      renderActivityToday(null);
    }
  }
  return { load };
}
