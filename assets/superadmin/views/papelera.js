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
  const input = prompt(`Escribe "${name}" para eliminar definitivamente este centro y todos sus datos:`);
  return input === name;
}

export function createPapeleraView(panelEl, onTenantsChanged) {
  function buildShell() {
    panelEl.innerHTML = `
      <div class="sa-head">
        <div><h1 class="sa-head-title">Papelera</h1></div>
      </div>
      <div class="sa-card">
        <div class="sa-card-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="sa-card-title">Centros eliminados</span>
            <span class="sa-card-count" id="trashCount">0</span>
          </div>
        </div>
        <p class="trash-info">
          Los centros en papelera se eliminan definitivamente pasados <strong>30 días</strong>.
          Puedes restaurarlos o eliminarlos antes de que venza el plazo.
        </p>
        <div class="sa-thead sa-thead--papelera">
          <div class="sa-th">Centro</div>
          <div class="sa-th">Tipo</div>
          <div class="sa-th">Eliminado</div>
          <div class="sa-th">Plazo</div>
          <div class="sa-th"></div>
        </div>
        <div class="sa-tbody" id="trashTbody">
          <div class="sa-empty-row">Cargando…</div>
        </div>
      </div>`;
  }

  async function load() {
    const tbodyEl = document.getElementById("trashTbody");
    const countEl = document.getElementById("trashCount");

    try {
      const res = await apiFetch("/api/v1/superadmin/tenants/trash");
      if (!res.ok) {
        if (tbodyEl) tbodyEl.innerHTML = `<div class="sa-empty-row">Error al cargar la papelera</div>`;
        return;
      }
      const d     = await res.json().catch(() => ({}));
      const items = d?.data?.items || [];
      if (countEl) countEl.textContent = items.length;

      if (!items.length) {
        if (tbodyEl) tbodyEl.innerHTML = `<div class="sa-empty-row">La papelera está vacía</div>`;
        return;
      }

      if (tbodyEl) tbodyEl.innerHTML = items.map(t => `
        <div class="sa-trow sa-trow--papelera" data-slug="${escHtml(t.slug)}" data-name="${escHtml(t.name)}">
          <div class="sa-td sa-td--name">${escHtml(t.name)}</div>
          <div class="sa-td sa-td--mono">${escHtml(t.type || "—")}</div>
          <div class="sa-td sa-td--muted">${fmtDate(t.deleted_at)}</div>
          <div class="sa-td">${daysLabel(t.days_remaining)}</div>
          <div class="sa-td trash-actions">
            <button class="btn-ghost trash-restore-btn" type="button">Restaurar</button>
            <button class="sa-btn-danger trash-purge-btn" type="button">Eliminar definitivamente</button>
          </div>
        </div>`).join("");
    } catch {
      if (tbodyEl) tbodyEl.innerHTML = `<div class="sa-empty-row">Error de red</div>`;
    }
  }

  async function handleRestore(slug, name) {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/restore`, { method: "POST" });
    if (res.ok) {
      showToast(`"${name}" restaurado`);
      await load();
      onTenantsChanged?.();
    } else {
      showToast("Error al restaurar el centro");
    }
  }

  async function handlePurge(slug, name) {
    const confirmed = await confirmPurge(name);
    if (!confirmed) return;
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/purge`, { method: "DELETE" });
    if (res.ok) {
      showToast(`"${name}" eliminado definitivamente`);
      await load();
      onTenantsChanged?.();
    } else {
      showToast("Error al eliminar el centro");
    }
  }

  function wireEvents() {
    const tbodyEl = document.getElementById("trashTbody");
    if (!tbodyEl) return;
    tbodyEl.addEventListener("click", async e => {
      const row  = e.target.closest(".sa-trow[data-slug]");
      if (!row) return;
      const slug = row.dataset.slug;
      const name = row.dataset.name;
      if (e.target.closest(".trash-restore-btn")) {
        await handleRestore(slug, name);
      } else if (e.target.closest(".trash-purge-btn")) {
        await handlePurge(slug, name);
      }
    });
  }

  return {
    init() {
      buildShell();
      wireEvents();
      load();
    },
    refresh: load,
  };
}
