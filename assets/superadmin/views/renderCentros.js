import { apiFetch } from "../../shared/js/auth.js";
import { escHtml, TYPE_MAP, typeBadge, estadoBadge, centroIni } from "../badges.js";
import { wireRowClicks } from "../wireRowClicks.js";

const FILTERS = [
  { k: "todos",      label: "Todos" },
  { k: "academia",   label: "Academia" },
  { k: "integrado",  label: "Centro integrado" },
  { k: "standalone", label: "Centro stand-alone" },
];

function buildRows(items) {
  if (!items.length) return `<div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">Sin centros</div>`;
  return items.map(t => `
    <div class="sa-trow sa-trow--centros-full" data-slug="${escHtml(t.slug)}" role="button" tabindex="0">
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
}

function buildPendingRows(items) {
  if (!items.length) return `<div style="padding:16px;font-size:12px;color:rgba(242,237,229,.35)">Sin solicitudes pendientes</div>`;
  return items.map(t => `
    <div class="sa-trow sa-trow--centros-full" style="gap:12px">
      <div class="sa-centro">
        <div class="sa-centro-av" style="background:rgba(255,200,100,.15);color:#ffc864">${centroIni(t.name)}</div>
        <div class="sa-centro-info">
          <span class="sa-centro-name">${escHtml(t.name)}</span>
          <span class="sa-centro-loc">${TYPE_MAP[t.type]?.label || escHtml(t.type || "—")}</span>
        </div>
      </div>
      ${typeBadge(t.type)}
      <span class="sa-slug">${escHtml(t.slug)}</span>
      <span class="sa-alumnos zero">—</span>
      ${estadoBadge("pending")}
      <button class="sa-btn sa-btn--sm" data-approve-slug="${escHtml(t.slug)}" type="button">Aprobar</button>
    </div>`).join("");
}

// Pestaña "Centros" — listado completo filtrable por tipo + pendientes de
// aprobación. `onNuevoCentro`/`onRowClick` reemplazan los cierres sobre
// openNuevoView/showTenantDetail; `onApproved` se llama tras aprobar con
// éxito para que el caller recargue allTenants (loadTenants vive en el
// archivo principal, no aquí).
export function renderCentros({ panel, allTenants, onNuevoCentro, onApproved, onRowClick }) {
  if (!panel) return;

  function counts() {
    const c = {};
    FILTERS.forEach(f => {
      c[f.k] = f.k === "todos" ? allTenants.length : allTenants.filter(t => t.type === f.k).length;
    });
    return c;
  }

  const cnt = counts();
  const pendingTenants = allTenants.filter(t => t.status === "pending");
  const activeTenants  = allTenants.filter(t => t.status !== "pending");

  panel.innerHTML = `
    <header class="sa-head">
      <div>
        <div class="sa-head-eye">Control global</div>
        <h1 class="sa-head-title">Centros</h1>
      </div>
    </header>
    <section class="sa-panel" id="pendingSection" style="${pendingTenants.length ? "" : "display:none"}">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Pendientes de aprobación</h2>
          <div class="sa-panel-sub">${pendingTenants.length} solicitud${pendingTenants.length !== 1 ? "es" : ""}</div>
        </div>
      </div>
      <div class="sa-table">
        <div class="sa-thead sa-thead--centros-full">
          <span class="sa-th">Centro</span><span class="sa-th">Tipo</span>
          <span class="sa-th">Slug</span><span class="sa-th r">Alumnos</span>
          <span class="sa-th r">Estado</span><span class="sa-th"></span>
        </div>
        <div class="sa-tbody" id="pendingTbody">${buildPendingRows(pendingTenants)}</div>
      </div>
    </section>
    <section class="sa-panel">
      <div class="sa-panel-head">
        <div>
          <h2 class="sa-panel-title">Todos los centros</h2>
          <div class="sa-panel-sub" id="centrosSubtitle">${activeTenants.length} centros · curso activo</div>
        </div>
        <button class="sa-btn" id="saNewCentroBtnCentros">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo centro
        </button>
      </div>
      <div class="sa-toolbar">
        <div class="sa-filters" id="centrosFilters">
          ${FILTERS.map(f => `
            <button class="sa-filter${f.k === "todos" ? " active" : ""}" data-filter="${f.k}">
              ${f.label}<span class="n">${cnt[f.k]}</span>
            </button>`).join("")}
        </div>
      </div>
      <div class="sa-table">
        <div class="sa-thead sa-thead--centros-full">
          <span class="sa-th">Centro</span>
          <span class="sa-th">Tipo</span>
          <span class="sa-th">Slug</span>
          <span class="sa-th r">Alumnos</span>
          <span class="sa-th r">Estado</span>
        </div>
        <div class="sa-tbody" id="centrosTbody">${buildRows(activeTenants)}</div>
      </div>
    </section>`;

  panel.querySelector("#saNewCentroBtnCentros")?.addEventListener("click", onNuevoCentro);

  panel.querySelector("#centrosFilters")?.addEventListener("click", e => {
    const btn = e.target.closest(".sa-filter");
    if (!btn) return;
    panel.querySelectorAll("#centrosFilters .sa-filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const f = btn.dataset.filter;
    const filtered = f === "todos" ? activeTenants : activeTenants.filter(t => t.type === f);
    const tbody = panel.querySelector("#centrosTbody");
    if (tbody) tbody.innerHTML = buildRows(filtered);
    const sub = panel.querySelector("#centrosSubtitle");
    if (sub) sub.textContent = `${filtered.length} centro${filtered.length !== 1 ? "s" : ""} · curso activo`;
    wireRowClicks(panel, allTenants, onRowClick);
  });

  panel.querySelector("#pendingTbody")?.addEventListener("click", async e => {
    const btn = e.target.closest("[data-approve-slug]");
    if (!btn) return;
    const slug = btn.dataset.approveSlug;
    if (!slug) return;
    btn.disabled = true;
    btn.textContent = "Aprobando…";
    try {
      const res = await apiFetch(`/api/v1/superadmin/tenants/${slug}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("approve failed");
      await onApproved();
    } catch {
      btn.disabled = false;
      btn.textContent = "Aprobar";
      alert("No se pudo aprobar el centro. Inténtalo de nuevo.");
    }
  });

  wireRowClicks(panel, allTenants, onRowClick);
}
