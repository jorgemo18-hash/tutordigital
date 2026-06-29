import { apiFetch } from "../../shared/js/auth.js";

const TIPOS = [
  { k: "academia",   label: "Academia",           color: "#d6a64a", sub: "Gestión administrativa completa" },
  { k: "integrado",  label: "Centro integrado",   color: "#8fb2c9", sub: "Conectado con Google Classroom" },
  { k: "standalone", label: "Centro stand-alone", color: "#9fc096", sub: "Sin sistema externo" },
];

const REGIMEN_FISCAL_OPTS = [
  { value: "autonomo", label: "Autónomo" },
  { value: "sociedad", label: "Sociedad (SL/SA)" },
];
const SECTOR_OPTS = [
  { value: "publico", label: "Público" },
  { value: "privado", label: "Privado / Concertado" },
];

function buildSelectFieldHtml(id, labelText, opciones) {
  return `
    <div class="sa-field">
      <label class="sa-flabel">${labelText}</label>
      <select class="sa-input" id="${id}">
        <option value="">Sin especificar</option>
        ${opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}
      </select>
    </div>`;
}

// Campo condicional según el tipo de centro elegido — academia muestra
// régimen fiscal (tenants.regimen_fiscal), standalone/integrado muestra
// sector (tenants.sector). Se reconstruye entero en cada cambio de tipo,
// así que un valor ya elegido no sobrevive a un cambio de tipo.
function renderTipoExtra(panel) {
  const cont = panel.querySelector("#saTipoExtra");
  if (!cont) return;
  const tipo = panel._selectedType;
  if (tipo === "academia") {
    cont.innerHTML = buildSelectFieldHtml("saNewRegimenFiscal", "Régimen fiscal", REGIMEN_FISCAL_OPTS);
  } else if (tipo === "standalone" || tipo === "integrado") {
    cont.innerHTML = buildSelectFieldHtml("saNewSector", "Sector", SECTOR_OPTS);
  } else {
    cont.innerHTML = "";
  }
}

function slugify(s) {
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Reset ligero (sin reconstruir HTML/listeners) para reaperturas del
// formulario tras la primera vez — buildNuevoForm de abajo solo se llama
// una vez por sesión (ver superadmin.js, nuevoFormReady).
export function resetNuevoForm(panel) {
  if (!panel) return;
  const q = id => panel.querySelector(`#${id}`);
  ["saNewName","saNewSlug","saNewAdminFirst","saNewAdminLast","saNewAdminEmail"].forEach(id => { const el = q(id); if (el) el.value = ""; });
  if (q("saNewSlug")) q("saNewSlug")._touched = false;
  const err = q("saFormError"); if (err) err.textContent = "";
  const btn = q("saFormConfirmBtn"); if (btn) { btn.disabled = false; btn.textContent = "Crear centro"; }
  panel.querySelectorAll("#saTypeRadios .sa-radio").forEach(r => r.classList.remove("active"));
  panel._selectedType = "";
  if (q("saTipoExtra")) q("saTipoExtra").innerHTML = "";
  panel.querySelectorAll("#saStatusRadios .sa-radio").forEach(r => r.classList.remove("active"));
  panel.querySelector("#saStatusRadios .sa-radio[data-status='trial']")?.classList.add("active");
  panel._selectedStatus = "trial";
}

// Alta de centro cliente (inline view). `onBack`/`onCreated` reemplazan
// los cierres sobre showView/loadTenants que tenía la versión original
// dentro de initSuperadmin.
export function buildNuevoForm({ panel, onBack, onCreated }) {
  if (!panel) return;
  panel._selectedType   = "";
  panel._selectedStatus = "trial";

  panel.innerHTML = `
    <header class="sa-head">
      <div>
        <div class="sa-head-eye">Alta de centro cliente</div>
        <h1 class="sa-head-title">Nuevo <em>centro</em></h1>
        <div class="sa-head-meta">
          <span>Se enviará una invitación al administrador</span>
        </div>
      </div>
      <div class="sa-head-controls">
        <button class="sa-back-btn" id="saNuevoBackBtn">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Volver
        </button>
      </div>
    </header>

    <div class="sa-form">
      <div class="sa-form-section">
        <div class="sa-form-eye">Datos del centro</div>

        <div class="sa-field">
          <label class="sa-flabel">Nombre del centro</label>
          <input class="sa-input" id="saNewName" type="text" placeholder="p. ej. Academia Lyceo" />
        </div>

        <div class="sa-field">
          <label class="sa-flabel">Tipo de centro</label>
          <div class="sa-radio-row" id="saTypeRadios">
            ${TIPOS.map(t => `
              <button class="sa-radio" type="button" data-type="${t.k}">
                <span class="sa-radio-name">
                  <span class="sa-radio-dot" style="background:${t.color}"></span>${t.label}
                </span>
                <span class="sa-radio-sub">${t.sub}</span>
              </button>`).join("")}
          </div>
        </div>

        <div id="saTipoExtra"></div>

        <div class="sa-field">
          <label class="sa-flabel">Slug <span class="sa-fhelp">· se genera del nombre</span></label>
          <input class="sa-input mono" id="saNewSlug" type="text" placeholder="academia-lyceo" />
        </div>
      </div>

      <div class="sa-form-section">
        <div class="sa-form-eye">Administrador del centro</div>
        <div class="sa-field-two">
          <div class="sa-field">
            <label class="sa-flabel">Nombre(s)</label>
            <input class="sa-input" id="saNewAdminFirst" type="text" placeholder="Jorge" />
          </div>
          <div class="sa-field">
            <label class="sa-flabel">Apellidos</label>
            <input class="sa-input" id="saNewAdminLast" type="text" placeholder="Moreno García" />
          </div>
        </div>
        <div class="sa-field">
          <label class="sa-flabel">Email <span class="sa-fhelp">· recibirá la invitación de acceso</span></label>
          <input class="sa-input mono" id="saNewAdminEmail" type="email" placeholder="admin@centro.es" />
        </div>
      </div>

      <div class="sa-form-section">
        <div class="sa-form-eye">Estado inicial</div>
        <div class="sa-radio-row" id="saStatusRadios">
          <button class="sa-radio active" type="button" data-status="trial">
            <span class="sa-radio-name">
              <span class="sa-radio-dot" style="background:#d6a64a"></span>Prueba
            </span>
            <span class="sa-radio-sub">14 días gratis</span>
          </button>
          <button class="sa-radio" type="button" data-status="active">
            <span class="sa-radio-name">
              <span class="sa-radio-dot" style="background:#9fc096"></span>Activo
            </span>
            <span class="sa-radio-sub">Facturación inmediata</span>
          </button>
          <button class="sa-radio" type="button" data-status="inactive">
            <span class="sa-radio-name">
              <span class="sa-radio-dot" style="background:rgba(242,237,229,0.35)"></span>Pausado
            </span>
            <span class="sa-radio-sub">Sin acceso aún</span>
          </button>
        </div>
      </div>

      <p class="sa-form-error" id="saFormError"></p>

      <div class="sa-form-foot">
        <button class="sa-btn-ghost" type="button" id="saFormCancelBtn">Cancelar</button>
        <button class="sa-btn" type="button" id="saFormConfirmBtn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          Crear centro
        </button>
      </div>
    </div>`;

  panel.querySelector("#saNuevoBackBtn")?.addEventListener("click", onBack);
  panel.querySelector("#saFormCancelBtn")?.addEventListener("click", onBack);

  panel.querySelector("#saTypeRadios")?.addEventListener("click", e => {
    const btn = e.target.closest(".sa-radio[data-type]");
    if (!btn) return;
    panel.querySelectorAll("#saTypeRadios .sa-radio").forEach(r => r.classList.remove("active"));
    btn.classList.add("active");
    panel._selectedType = btn.dataset.type;
    renderTipoExtra(panel);
  });

  panel.querySelector("#saStatusRadios")?.addEventListener("click", e => {
    const btn = e.target.closest(".sa-radio[data-status]");
    if (!btn) return;
    panel.querySelectorAll("#saStatusRadios .sa-radio").forEach(r => r.classList.remove("active"));
    btn.classList.add("active");
    panel._selectedStatus = btn.dataset.status;
  });

  const nameInput = panel.querySelector("#saNewName");
  const slugInput = panel.querySelector("#saNewSlug");
  nameInput?.addEventListener("input", e => {
    if (!slugInput._touched) slugInput.value = slugify(e.target.value);
  });
  slugInput?.addEventListener("input", e => { e.target._touched = e.target.value.length > 0; });

  panel.querySelector("#saFormConfirmBtn")?.addEventListener("click", async () => {
    const name       = panel.querySelector("#saNewName").value.trim();
    const slug       = panel.querySelector("#saNewSlug").value.trim();
    const type       = panel._selectedType   || "";
    const status     = panel._selectedStatus || "trial";
    const adminFirst = panel.querySelector("#saNewAdminFirst").value.trim();
    const adminLast  = panel.querySelector("#saNewAdminLast").value.trim();
    const adminEmail = panel.querySelector("#saNewAdminEmail").value.trim();
    const regimenFiscal = panel.querySelector("#saNewRegimenFiscal")?.value || "";
    const sector     = panel.querySelector("#saNewSector")?.value || "";
    const errEl      = panel.querySelector("#saFormError");
    const confirmBtn = panel.querySelector("#saFormConfirmBtn");

    errEl.textContent = "";
    if (!name)       { errEl.textContent = "El nombre del centro es obligatorio."; return; }
    if (!slug)       { errEl.textContent = "El slug es obligatorio."; return; }
    if (!adminFirst) { errEl.textContent = "El nombre del administrador es obligatorio."; return; }
    if (!adminLast)  { errEl.textContent = "Los apellidos son obligatorios."; return; }
    if (!adminEmail) { errEl.textContent = "El email del administrador es obligatorio."; return; }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Creando…";

    try {
      const body = { name, slug, status, admin: { first_name: adminFirst, last_name: adminLast, email: adminEmail } };
      if (type) body.type = type;
      if (regimenFiscal) body.regimen_fiscal = regimenFiscal;
      if (sector) body.sector = sector;
      const res = await apiFetch("/api/v1/superadmin/tenants", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { errEl.textContent = data?.error?.message || "No se pudo crear el centro."; return; }
      await onCreated();
    } catch {
      errEl.textContent = "Error de red. Inténtalo de nuevo.";
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Crear centro";
    }
  });

  setTimeout(() => panel.querySelector("#saNewName")?.focus(), 60);
}
