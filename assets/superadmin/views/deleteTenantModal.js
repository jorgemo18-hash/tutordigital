import { apiFetch } from "../../shared/js/auth.js";
import { escHtml } from "../../shared/js/escHtml.js";

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

function getOrCreateModal() {
  let modal = document.getElementById("saDeleteTenantModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "saDeleteTenantModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Mover a la papelera</h2>
        <button class="modal-close" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <div class="del-modal-stats" id="delModalStats">Cargando datos del centro…</div>
        <p class="del-modal-warning">
          El centro pasará a la papelera. Tendrás <strong>30 días</strong> para restaurarlo
          antes de que se elimine definitivamente junto con todos sus datos.
        </p>
        <label class="field">
          <span>Escribe <strong id="delModalNameHint"></strong> para confirmar</span>
          <input id="delModalNameInput" type="text" autocomplete="off"
                 placeholder="Nombre exacto del centro" />
        </label>
        <p class="modal-error" id="delModalError"></p>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" type="button" id="delModalCancelBtn">Cancelar</button>
        <button class="cd-delete-btn del-modal-confirm-btn" type="button" id="delModalConfirmBtn"
                disabled>Mover a la papelera</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".modal-close").addEventListener("click", () => modal.classList.remove("open"));
  modal.querySelector("#delModalCancelBtn").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

  return modal;
}

/**
 * Abre el modal de confirmación de eliminación suave.
 * @param {{ slug: string, name: string }} tenant
 * @param {() => void} onDeleted — callback tras eliminar con éxito
 */
export async function openDeleteModal(tenant, onDeleted) {
  const modal = getOrCreateModal();
  const statsEl   = modal.querySelector("#delModalStats");
  const nameHint  = modal.querySelector("#delModalNameHint");
  const nameInput = modal.querySelector("#delModalNameInput");
  const confirmBtn = modal.querySelector("#delModalConfirmBtn");
  const errEl     = modal.querySelector("#delModalError");

  // Resetear estado
  statsEl.textContent = "Cargando datos del centro…";
  nameHint.textContent = `"${tenant.name}"`;
  nameInput.value = "";
  confirmBtn.disabled = true;
  errEl.textContent = "";

  modal.classList.add("open");
  nameInput.focus();

  // Cargar estadísticas
  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}/stats`);
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      const s = d?.data || {};
      statsEl.innerHTML = `
        <div class="del-modal-stat"><span>${s.students ?? "—"}</span><small>alumnos</small></div>
        <div class="del-modal-stat"><span>${s.teachers ?? "—"}</span><small>profesores</small></div>
        <div class="del-modal-stat"><span>${s.tasks ?? "—"}</span><small>tareas</small></div>
      `;
    } else {
      statsEl.textContent = "No se pudieron cargar los datos del centro.";
    }
  } catch {
    statsEl.textContent = "Error al cargar datos.";
  }

  // Habilitar botón solo cuando el nombre coincide
  nameInput.oninput = () => {
    confirmBtn.disabled = nameInput.value.trim() !== tenant.name;
    errEl.textContent = "";
  };

  confirmBtn.onclick = async () => {
    if (nameInput.value.trim() !== tenant.name) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Eliminando…";
    errEl.textContent = "";

    try {
      const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        errEl.textContent = d?.error?.message || "No se pudo eliminar el centro.";
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Mover a la papelera";
        return;
      }
      modal.classList.remove("open");
      showToast(`"${tenant.name}" movido a la papelera`);
      onDeleted?.();
    } catch {
      errEl.textContent = "Error de red. Inténtalo de nuevo.";
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Mover a la papelera";
    }
  };
}
