import { escHtml, TYPE_MAP, typeBadge, estadoBadge, centroIni } from "../badges.js";
import { wireRowClicks } from "../wireRowClicks.js";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function nowLabel() {
  return new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

// Pestaña "Inicio" — KPIs globales + los 5 centros más recientes.
// `onVerTodos`/`onNuevoCentro`/`onRowClick` reemplazan los cierres sobre
// showView/openNuevoView/showTenantDetail que tenía la versión original
// dentro de initSuperadmin.
export function renderInicio({ panel, allTenants, globalStats, firstName, onVerTodos, onNuevoCentro, onRowClick }) {
  if (!panel) return;

  const nActive   = globalStats.centros_activos  ?? 0;
  const nStudents = globalStats.alumnos_totales  ?? 0;
  const nSessions = globalStats.sesiones_mes     ?? 0;
  const nTeachers = globalStats.docentes_totales ?? 0;

  const recent5 = allTenants
    .slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const rows = recent5.map(t => `
    <div class="sa-trow sa-trow--centros" data-slug="${escHtml(t.slug)}" role="button" tabindex="0">
      <div class="sa-centro">
        <div class="sa-centro-av">${centroIni(t.name)}</div>
        <div class="sa-centro-info">
          <span class="sa-centro-name">${escHtml(t.name)}</span>
          <span class="sa-centro-loc">${TYPE_MAP[t.type]?.label || escHtml(t.type || "—")}</span>
        </div>
      </div>
      ${typeBadge(t.type)}
      <span class="sa-slug">${escHtml(t.slug)}</span>
      <span class="sa-alumnos${(t.active_students ?? 0) === 0 ? " zero" : ""}">
        ${(t.active_students ?? 0).toLocaleString("es-ES")}
        <small>${(t.active_students ?? 0) === 1 ? "alumno" : "alumnos"}</small>
      </span>
      ${estadoBadge(t.status || "active")}
    </div>`).join("");

  panel.innerHTML = `
    <header class="sa-head">
      <div>
        <div class="sa-head-eye">${getGreeting()}, ${escHtml(firstName)}</div>
        <h1 class="sa-head-title">Inicio</h1>
        <div class="sa-head-meta">
          <span>${allTenants.length} centros</span>
          <span class="sep">·</span>
          <span>${nStudents.toLocaleString("es-ES")} alumnos</span>
          <span class="sep">·</span>
          <span>${nowLabel()}</span>
        </div>
      </div>
    </header>

    <div class="sa-metrics">
      <div class="sa-metric${nActive > 0 ? " featured" : ""}">
        <span class="sa-metric-eye">Centros activos</span>
        <span class="sa-metric-num">${nActive.toLocaleString("es-ES")}</span>
        <span class="sa-metric-foot"><span class="dot"></span>en producción</span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Alumnos totales</span>
        <span class="sa-metric-num">${nStudents.toLocaleString("es-ES")}</span>
        <span class="sa-metric-foot"><span class="dot"></span>en la plataforma</span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Sesiones este mes</span>
        <span class="sa-metric-num">${nSessions.toLocaleString("es-ES")}</span>
        <span class="sa-metric-foot"><span class="dot"></span>con el tutor IA</span>
      </div>
      <div class="sa-metric">
        <span class="sa-metric-eye">Docentes totales</span>
        <span class="sa-metric-num">${nTeachers.toLocaleString("es-ES")}</span>
        <span class="sa-metric-foot"><span class="dot"></span>en todos los centros</span>
      </div>
    </div>

    <section class="sa-panel">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Centros recientes</h2>
          <div class="sa-panel-sub">${recent5.length} de ${allTenants.length} total</div>
        </div>
        <button class="sa-link" id="saVerTodosBtn">Ver todos los centros →</button>
      </div>
      <div class="sa-toolbar">
        <div></div>
        <button class="sa-btn" id="saNewCentroBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo centro
        </button>
      </div>
      <div class="sa-table">
        <div class="sa-thead sa-thead--centros">
          <span class="sa-th">Centro</span>
          <span class="sa-th">Tipo</span>
          <span class="sa-th">Slug</span>
          <span class="sa-th r">Alumnos</span>
          <span class="sa-th r">Estado</span>
        </div>
        <div class="sa-tbody">
          ${rows || `<div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">Sin centros todavía</div>`}
        </div>
      </div>
    </section>`;

  panel.querySelector("#saVerTodosBtn")?.addEventListener("click", onVerTodos);
  panel.querySelector("#saNewCentroBtn")?.addEventListener("click", onNuevoCentro);
  wireRowClicks(panel, allTenants, onRowClick);
}
