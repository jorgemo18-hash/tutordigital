import { apiFetch } from "../../shared/js/auth.js";

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function showToast(msg) {
  let el = document.getElementById("cdToast");
  if (!el) {
    el = Object.assign(document.createElement("div"), { id: "cdToast", className: "cd-toast" });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("cd-toast-visible");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("cd-toast-visible"), 2500);
}
function daysLabel(n) {
  if (n <= 0) return `<span class="trash-days trash-days-urgent">Expira hoy</span>`;
  if (n <= 5) return `<span class="trash-days trash-days-urgent">${n} día${n !== 1 ? "s" : ""} restantes</span>`;
  return `<span class="trash-days">${n} días restantes</span>`;
}
async function confirmPurge(name) {
  return prompt(`Escribe "${name}" para eliminar definitivamente:`) === name;
}

export function createPapeleraView(panelEl, onTenantsChanged) {
  function buildShell() {
    panelEl.innerHTML = `
      <header class="sa-head">
        <div>
          <div class="sa-head-eye">Gestión</div>
          <h1 class="sa-head-title">Papelera</h1>
        </div>
      </header>
      <section class="sa-panel">
        <div class="sa-panel-head">
          <div>
            <h2 class="sa-panel-title">Centros eliminados</h2>
            <div class="sa-panel-sub" id="trashSub">—</div>
          </div>
        </div>
        <p class="trash-info">
          Los centros en papelera se eliminan definitivamente pasados <strong>30 días</strong>.
          Puedes restaurarlos o eliminarlos antes de que venza el plazo.
        </p>
        <div class="sa-table">
          <div class="sa-thead sa-thead--papelera">
            <span class="sa-th">Centro</span>
            <span class="sa-th">Tipo</span>
            <span class="sa-th">Eliminado</span>
            <span class="sa-th">Plazo</span>
            <span class="sa-th"></span>
          </div>
          <div class="sa-tbody" id="trashTbody">
            <div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">Cargando…</div>
          </div>
        </div>
      </section>`;
  }

  const TYPE_LABELS = {
    academia:            "Academia",
    instituto_integrado: "Instituto integrado",
    standalone:          "Stand-alone",
  };

  async function load() {
    const tbodyEl = document.getElementById("trashTbody");
    const subEl   = document.getElementById("trashSub");

    try {
      const res = await apiFetch("/api/v1/superadmin/tenants/trash");
      if (!res.ok) {
        if (tbodyEl) tbodyEl.innerHTML = `<div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">Error al cargar la papelera</div>`;
        return;
      }
      const d     = await res.json().catch(() => ({}));
      const items = d?.data?.items || [];

      if (subEl) subEl.textContent = items.length ? `${items.length} centro${items.length !== 1 ? "s" : ""} en espera` : "vacía";

      if (!items.length) {
        if (tbodyEl) tbodyEl.innerHTML = `<div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">La papelera está vacía</div>`;
        return;
      }

      if (tbodyEl) tbodyEl.innerHTML = items.map(t => `
        <div class="sa-trow sa-trow--papelera" data-slug="${escHtml(t.slug)}" data-name="${escHtml(t.name)}">
          <div class="sa-centro">
            <div class="sa-centro-av">${escHtml((t.name || "?")[0].toUpperCase())}</div>
            <div class="sa-centro-info">
              <span class="sa-centro-name">${escHtml(t.name)}</span>
            </div>
          </div>
          <span style="font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.55)">${escHtml(TYPE_LABELS[t.type] || t.type || "—")}</span>
          <span style="font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.50)">${fmtDate(t.deleted_at)}</span>
          <div>${daysLabel(t.days_remaining)}</div>
          <div class="trash-actions">
            <button class="btn-ghost trash-restore-btn" type="button">Restaurar</button>
            <button class="sa-btn-danger trash-purge-btn" type="button">Eliminar definitivamente</button>
          </div>
        </div>`).join("");
    } catch {
      if (tbodyEl) tbodyEl.innerHTML = `<div style="padding:20px 16px;font-family:var(--mono);font-size:11px;color:rgba(242,237,229,0.35)">Error de red</div>`;
    }
  }

  async function handleRestore(slug, name) {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/restore`, { method: "POST" });
    if (res.ok) { showToast(`"${name}" restaurado`); await load(); onTenantsChanged?.(); }
    else showToast("Error al restaurar el centro");
  }

  async function handlePurge(slug, name) {
    if (!await confirmPurge(name)) return;
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/purge`, { method: "DELETE" });
    if (res.ok) { showToast(`"${name}" eliminado definitivamente`); await load(); onTenantsChanged?.(); }
    else showToast("Error al eliminar el centro");
  }

  function wireEvents() {
    const tbody = document.getElementById("trashTbody");
    if (!tbody) return;
    tbody.addEventListener("click", async e => {
      const row = e.target.closest(".sa-trow[data-slug]");
      if (!row) return;
      if (e.target.closest(".trash-restore-btn")) await handleRestore(row.dataset.slug, row.dataset.name);
      else if (e.target.closest(".trash-purge-btn")) await handlePurge(row.dataset.slug, row.dataset.name);
    });
  }

  return {
    init() { buildShell(); wireEvents(); load(); },
    refresh: load,
  };
}
