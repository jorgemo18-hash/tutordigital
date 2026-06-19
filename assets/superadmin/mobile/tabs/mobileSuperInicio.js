// mobileSuperInicio.js — Tab Inicio: KPIs globales + lista de centros
// filtrable por tipo. Sin campo de ubicación: el tenant real no tiene
// columna de ciudad (a diferencia del mock de referencia).

import { fetchTenants } from "../mobileSuperData.js";
import { icon } from "../../../admin/mobile/mobileAdminIcons.js";
import { TYPE_LABEL, estadoBadgeHtml, tipoBadgeHtml } from "../mobileSuperShared.js";

const TYPE_ORDER = ["academia", "instituto_integrado", "standalone"];

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _centroRowHtml(t) {
  const n = t.active_students ?? 0;
  return `
    <div class="centro-row" data-slug="${_esc(t.slug)}">
      <div class="centro-av">${_esc((t.name || "?")[0].toUpperCase())}</div>
      <div class="centro-main">
        <div class="centro-name">${_esc(t.name)}</div>
        <div class="centro-sub">${tipoBadgeHtml(t.type)}</div>
      </div>
      <div class="centro-right">
        ${estadoBadgeHtml(t.status)}
        <span class="centro-alumnos${n === 0 ? " zero" : ""}">${n.toLocaleString("es-ES")} alum.</span>
      </div>
    </div>`;
}

export async function renderSuperInicio({ containerEl, onOpen, onNew }) {
  let tenants = [];
  let filter  = "todos";

  function _draw() {
    const counts = { todos: tenants.length };
    TYPE_ORDER.forEach(k => { counts[k] = tenants.filter(t => t.type === k).length; });
    const filters = [{ k: "todos", label: "Todos" }, ...TYPE_ORDER.map(k => ({ k, label: TYPE_LABEL[k] }))];
    const rows = filter === "todos" ? tenants : tenants.filter(t => t.type === filter);

    const nActive   = tenants.filter(t => t.status === "active").length;
    const nStudents = tenants.reduce((s, t) => s + (t.active_students || 0), 0);
    const nSessions = tenants.reduce((s, t) => s + (t.sessions_this_month || 0), 0); // TODO: campo no existe aún en el backend
    const nTeachers = tenants.reduce((s, t) => s + (t.active_teachers || 0), 0);     // TODO: campo no existe aún en el backend

    containerEl.innerHTML = `
      <div class="phead">
        <div class="phead-row">
          <div>
            <div class="phead-eyebrow">Control global · Fundador</div>
            <h1 class="phead-title"><em>Inicio</em></h1>
          </div>
          <button type="button" class="phead-pill" id="spNewBtn">${icon("plus", { size: 15, sw: 2.4 })} Centro</button>
        </div>
        <div class="phead-meta"><span>${tenants.length} centro${tenants.length !== 1 ? "s" : ""}</span><span class="sep"></span><span>${nStudents.toLocaleString("es-ES")} alumnos</span></div>
      </div>

      <div class="smetrics">
        <div class="smetric${nActive > 0 ? " featured" : ""}">
          <span class="smetric-eye">Centros activos</span>
          <span class="smetric-num">${nActive || tenants.length || "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>en producción</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Alumnos totales</span>
          <span class="smetric-num">${nStudents ? nStudents.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>en la plataforma</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Sesiones este mes</span>
          <span class="smetric-num">${nSessions ? nSessions.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>con el tutor IA</span>
        </div>
        <div class="smetric">
          <span class="smetric-eye">Docentes totales</span>
          <span class="smetric-num">${nTeachers ? nTeachers.toLocaleString("es-ES") : "—"}</span>
          <span class="smetric-foot"><span class="dot"></span>en todos los centros</span>
        </div>
      </div>

      <div class="seclabel">
        <span class="seclabel-name">Centros clientes</span>
        <span class="seclabel-count">${rows.length}</span>
        <span class="seclabel-line"></span>
      </div>

      <div class="sfilters">
        ${filters.map(f => `<button type="button" class="sfilt${filter === f.k ? " active" : ""}" data-filter="${f.k}">${_esc(f.label)}<span class="n">${counts[f.k]}</span></button>`).join("")}
      </div>

      <div class="centro-list">
        ${rows.length ? rows.map(_centroRowHtml).join("") : `<p class="dcard-empty">No hay centros en este filtro.</p>`}
      </div>`;

    containerEl.querySelector("#spNewBtn").addEventListener("click", onNew);
    containerEl.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => { filter = btn.dataset.filter; _draw(); }));
    containerEl.querySelectorAll("[data-slug]").forEach(row => row.addEventListener("click", () => {
      const t = tenants.find(x => x.slug === row.dataset.slug);
      if (t) onOpen(t);
    }));
  }

  containerEl.innerHTML = `<p class="dcard-empty">Cargando…</p>`;
  const data = await fetchTenants().catch(() => ({ items: [] }));
  tenants = data?.items || [];
  _draw();

  return {
    refresh: async () => { const d = await fetchTenants().catch(() => ({ items: [] })); tenants = d?.items || []; _draw(); },
    getCount: () => tenants.length,
  };
}
