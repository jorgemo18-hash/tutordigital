import { apiFetch } from "../../shared/js/auth.js";
import { openDeleteModal } from "./deleteTenantModal.js";
import { buildHead, buildKPIs, buildInfoPanel, renderInfoRead, renderInfoEdit, buildPeopleRow, buildDangerZone } from "./centro-detalle/builders.js";
import { patchTenant, patchAdmin, loadPeople } from "./centro-detalle/api.js";
import { showToast } from "./centro-detalle/toast.js";

// ── Info panel: wire ───────────────────────────────────────────────────────
async function wireInfoPanel(tenant) {
  const inner = document.getElementById("cdInfoInner");
  const panel = document.getElementById("cdInfoPanel");
  const t     = { ...tenant };
  const ad    = { display_name: null, email: null, phone: null };

  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(t.slug)}/admin`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      Object.assign(ad, body?.data || {});
    }
  } catch {}

  function showRead() {
    if (panel) {
      const editBtn = panel.querySelector("#cdEditBtn");
      if (editBtn) editBtn.style.display = "";
    }
    if (inner) inner.innerHTML = renderInfoRead(t, ad);
  }

  function showEdit() {
    if (panel) {
      const editBtn = panel.querySelector("#cdEditBtn");
      if (editBtn) editBtn.style.display = "none";
    }
    if (inner) inner.innerHTML = renderInfoEdit(t, ad);
    document.getElementById("cdCancelBtn")?.addEventListener("click", showRead);
    document.getElementById("cdSaveBtn")?.addEventListener("click", handleSave);
  }

  async function handleSave() {
    const saveBtn = document.getElementById("cdSaveBtn");
    saveBtn.disabled = true; saveBtn.textContent = "Guardando…";

    const newName   = document.getElementById("cdEditName")?.value.trim() || t.name;
    const newType   = document.getElementById("cdEditType")?.value;
    const newAName  = document.getElementById("cdEditAdminName")?.value.trim();
    const newAEmail = document.getElementById("cdEditAdminEmail")?.value.trim();
    const newAPhone = document.getElementById("cdEditAdminPhone")?.value.trim();

    const tenantPatch = {};
    if (newName !== t.name)         tenantPatch.name = newName;
    if (newType !== (t.type || "")) tenantPatch.type = newType;

    const adminPatch = {};
    if (newAName  !== (ad.display_name || "")) adminPatch.display_name = newAName;
    if (newAEmail !== (ad.email || ""))        adminPatch.email = newAEmail;
    if (newAPhone !== (ad.phone || ""))        adminPatch.phone = newAPhone;

    let allOk = true;
    if (Object.keys(tenantPatch).length) {
      const ok = await patchTenant(t.slug, tenantPatch);
      if (ok) Object.assign(t, tenantPatch); else allOk = false;
    }
    if (allOk && Object.keys(adminPatch).length) {
      const ok = await patchAdmin(t.slug, adminPatch);
      if (ok) Object.assign(ad, adminPatch); else allOk = false;
    }
    if (allOk) {
      const h = document.getElementById("cdHeaderName");
      if (h) h.textContent = t.name;
      showToast("Cambios guardados");
      showRead();
    } else {
      saveBtn.disabled = false; saveBtn.textContent = "Guardar";
    }
  }

  panel?.querySelector("#cdEditBtn")?.addEventListener("click", showEdit);
  showRead();
}

// ── Event wiring ───────────────────────────────────────────────────────────
function wireEvents(tenant, onBack) {
  document.getElementById("cdBackBtn")?.addEventListener("click", () => onBack?.());

  document.getElementById("cdAdminBtn")?.addEventListener("click", async e => {
    const btn = e.currentTarget;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Generando enlace…";
    try {
      const res  = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(tenant.slug)}/impersonate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.data?.url) { alert(data?.error?.message || "No se pudo generar el enlace."); return; }
      window.open(data.data.url, "_blank");
    } catch { alert("Error de red."); }
    finally { btn.disabled = false; btn.textContent = orig; }
  });

  const saveBtn = document.getElementById("cdStatusSaveBtn");
  saveBtn?.addEventListener("click", async () => {
    const sel = document.getElementById("cdStatusSelect");
    saveBtn.disabled = true; saveBtn.textContent = "Guardando…";
    const ok = await patchTenant(tenant.slug, { status: sel?.value });
    if (ok) {
      saveBtn.textContent = "¡Guardado!";
      setTimeout(() => { saveBtn.textContent = "Guardar"; saveBtn.disabled = false; }, 1500);
    } else {
      saveBtn.disabled = false; saveBtn.textContent = "Guardar";
    }
  });

  document.getElementById("cdDeleteBtn")?.addEventListener("click", () => {
    openDeleteModal(tenant, () => onBack?.());
  });
}

// ── Factory ────────────────────────────────────────────────────────────────
export function createCentroDetalleView(panelEl) {
  return {
    show(tenant, onBack) {
      panelEl.innerHTML =
        buildHead(tenant, onBack) +
        buildKPIs() +
        buildInfoPanel(tenant) +
        buildPeopleRow() +
        buildDangerZone(tenant);

      wireEvents(tenant, onBack);
      wireInfoPanel(tenant);
      loadPeople(tenant.slug);
    },
    hide() {
      panelEl.innerHTML = "";
    },
  };
}
