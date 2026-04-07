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

/**
 * Fábrica de la vista Papelera.
 * @param {HTMLElement} panelEl
 */
export function createPapeleraView(panelEl, onTenantsChanged) {
  function buildShell() {
    panelEl.innerHTML = `
      <div class="table-card">
        <div class="table-header">
          <div class="table-title-wrap">
            <span class="table-title">Papelera de centros</span>
            <span class="table-count" id="trashCount">0</span>
          </div>
        </div>
        <p class="trash-info">
          Los centros en papelera se eliminan definitivamente pasados <strong>30 días</strong>.
          Puedes restaurarlos o eliminarlos antes de que venza el plazo.
        </p>
        <table class="sa-table">
          <thead>
            <tr>
              <th>Centro</th>
              <th>Tipo</th>
              <th>Eliminado</th>
              <th>Plazo</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="trashTbody">
            <tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Cargando…</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  async function load() {
    const tbody   = document.getElementById("trashTbody");
    const countEl = document.getElementById("trashCount");

    try {
      const res = await apiFetch("/api/v1/superadmin/tenants/trash");
      if (!res.ok) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Error al cargar la papelera</td></tr>`;
        return;
      }
      const d = await res.json().catch(() => ({}));
      const items = d?.data?.items || [];
      if (countEl) countEl.textContent = items.length;

      if (!items.length) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">La papelera está vacía</td></tr>`;
        return;
      }

      if (tbody) tbody.innerHTML = items.map(t => `
        <tr data-slug="${escHtml(t.slug)}" data-name="${escHtml(t.name)}">
          <td class="cell-name">${escHtml(t.name)}</td>
          <td style="font-size:11px;color:var(--text-muted)">${escHtml(t.type || "—")}</td>
          <td style="font-size:12px;color:var(--text-muted)">${fmtDate(t.deleted_at)}</td>
          <td>${daysLabel(t.days_remaining)}</td>
          <td class="trash-actions">
            <button class="btn-ghost trash-restore-btn" type="button">Restaurar</button>
            <button class="cd-delete-btn trash-purge-btn" type="button">Eliminar definitivamente</button>
          </td>
        </tr>
      `).join("");
    } catch {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Error de red</td></tr>`;
    }
  }

  async function handleRestore(slug, name) {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/restore`, {
      method: "POST",
    });
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

    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/purge`, {
      method: "DELETE",
    });
    if (res.ok) {
      showToast(`"${name}" eliminado definitivamente`);
      await load();
      onTenantsChanged?.();
    } else {
      showToast("Error al eliminar el centro");
    }
  }

  function wireEvents() {
    const tbody = document.getElementById("trashTbody");
    if (!tbody) return;

    tbody.addEventListener("click", async (e) => {
      const row  = e.target.closest("tr[data-slug]");
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
