// mobileSuperNuevo.js — Drill-in: alta de centro cliente. Mismo payload que
// el formulario de escritorio (assets/superadmin/superadmin.js
// buildNuevoForm). Nota: el campo "status" se envía pero el backend
// (CreateTenantSchema en superadmin.routes.js) no lo admite todavía y lo
// ignora en silencio — mismo comportamiento que el formulario de escritorio,
// no es una regresión introducida aquí.

import { icon } from "../../../admin/mobile/mobileAdminIcons.js";
import { createTenant } from "../mobileSuperData.js";

const TIPOS = [
  { k: "academia",   label: "Academia",            color: "#d6a64a" },
  { k: "integrado",  label: "Centro integrado",    color: "#8fb2c9" },
  { k: "standalone", label: "Centro stand-alone",  color: "#9fc096" },
];
const ESTADOS = [
  { k: "trial",    label: "Prueba",  color: "#d6a64a" },
  { k: "active",   label: "Activo",  color: "#9fc096" },
  { k: "inactive", label: "Pausado", color: "rgba(242,237,229,0.55)" },
];

// Campo condicional según tipo — mismos values, descripciones y mismo
// criterio que el formulario de escritorio
// (assets/superadmin/views/nuevoCentroForm.js): academia pide régimen
// fiscal, standalone/integrado pide sector. Tarjetas .sa-radio (estilos
// de superadmin.css, cargados también en mobile) en vez de chips porque
// necesitan una línea de descripción que .chip no tiene.
const REGIMEN_FISCAL_OPTS = [
  { value: "autonomo", label: "Autónomo", sub: "IRPF — Modelo 130" },
  { value: "sociedad", label: "Sociedad (SL/SA)", sub: "IS — Modelo 202" },
];
const SECTOR_OPTS = [
  { value: "publico", label: "Público", sub: "Centro de titularidad pública" },
  { value: "privado", label: "Privado", sub: "Centro de titularidad privada" },
  { value: "concertado", label: "Concertado", sub: "Financiación pública, gestión privada" },
];

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _buildTarjetaHtml(value, label, sub) {
  return `
    <button class="sa-radio" type="button" data-value="${value}">
      <span class="sa-radio-name">${_esc(label)}</span>
      <span class="sa-radio-sub">${_esc(sub)}</span>
    </button>`;
}

function _tipoExtraHtml(tipo) {
  if (tipo === "academia") {
    return `<div><label class="field-label">Régimen fiscal</label><div class="sa-radio-row">${REGIMEN_FISCAL_OPTS.map(o => _buildTarjetaHtml(o.value, o.label, o.sub)).join("")}</div></div>`;
  }
  if (tipo === "standalone" || tipo === "integrado") {
    return `<div><label class="field-label">Sector</label><div class="sa-radio-row">${SECTOR_OPTS.map(o => _buildTarjetaHtml(o.value, o.label, o.sub)).join("")}</div></div>`;
  }
  return "";
}

function _slugify(s) {
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function renderSuperNuevo({ hostEl, onClose, onCreated }) {
  let tipo          = "academia";
  let estado        = "trial";
  let regimenFiscal = "";
  let sector        = "";
  let slugTouched   = false;

  hostEl.innerHTML = `
    <div class="drill">
      <header class="drill-head">
        <button class="iconbtn bordered" id="snBack" aria-label="Volver">${icon("arrowL", { size: 20 })}</button>
        <div class="drill-head-info">
          <div class="drill-head-pill">Alta de centro cliente</div>
          <div class="drill-head-title">Nuevo centro</div>
        </div>
      </header>
      <div class="drill-body">
        <div class="gblock">
          <div class="sinfo-eye">Datos del centro</div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div><label class="field-label">Nombre del centro</label><input class="ginput" style="width:100%" id="snName" placeholder="p. ej. Academia Lyceo"></div>
            <div>
              <label class="field-label">Tipo de centro</label>
              <div class="pickline-chips" id="snTipoChips">
                ${TIPOS.map(t => `<button type="button" class="chip${tipo === t.k ? " on" : ""}" data-tipo="${t.k}"><span class="legend-dot" style="background:${t.color}"></span>${_esc(t.label)}</button>`).join("")}
              </div>
            </div>
            <div id="snTipoExtra">${_tipoExtraHtml(tipo)}</div>
            <div><label class="field-label">Slug · se genera del nombre</label><input class="ginput mono" style="width:100%" id="snSlug" placeholder="academia-lyceo"></div>
          </div>
        </div>

        <div class="gblock">
          <div class="sinfo-eye">Administrador del centro</div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div><label class="field-label">Nombre</label><input class="ginput" style="width:100%" id="snAdminFirst" placeholder="Nombre"></div>
            <div><label class="field-label">Apellidos</label><input class="ginput" style="width:100%" id="snAdminLast" placeholder="Apellidos"></div>
            <div><label class="field-label">Email · recibirá la invitación</label><input class="ginput mono" style="width:100%" id="snAdminEmail" placeholder="admin@centro.es"></div>
          </div>
        </div>

        <div class="gblock">
          <div class="sinfo-eye">Estado inicial</div>
          <div class="pickline-chips" id="snEstadoChips">
            ${ESTADOS.map(e => `<button type="button" class="chip${estado === e.k ? " on" : ""}" data-estado="${e.k}"><span class="legend-dot" style="background:${e.color}"></span>${_esc(e.label)}</button>`).join("")}
          </div>
        </div>

        <p class="sheet-error" id="snError"></p>

        <div style="display:flex;gap:11px">
          <button class="btn btn-ghost" style="flex:1" id="snCancelBtn" type="button">Cancelar</button>
          <button class="btn btn-primary" style="flex:1" id="snCreateBtn" type="button">${icon("check", { size: 16 })} Crear centro</button>
        </div>
      </div>
    </div>`;

  hostEl.querySelector("#snBack").addEventListener("click", onClose);
  hostEl.querySelector("#snCancelBtn").addEventListener("click", onClose);

  hostEl.querySelector("#snTipoChips").addEventListener("click", ev => {
    const btn = ev.target.closest("[data-tipo]");
    if (!btn) return;
    tipo = btn.dataset.tipo;
    regimenFiscal = "";
    sector = "";
    hostEl.querySelectorAll("#snTipoChips .chip").forEach(c => c.classList.toggle("on", c === btn));
    hostEl.querySelector("#snTipoExtra").innerHTML = _tipoExtraHtml(tipo);
  });
  hostEl.querySelector("#snTipoExtra").addEventListener("click", ev => {
    const btn = ev.target.closest(".sa-radio[data-value]");
    if (!btn) return;
    hostEl.querySelectorAll("#snTipoExtra .sa-radio").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    if (tipo === "academia") regimenFiscal = btn.dataset.value;
    else if (tipo === "standalone" || tipo === "integrado") sector = btn.dataset.value;
  });
  hostEl.querySelector("#snEstadoChips").addEventListener("click", ev => {
    const btn = ev.target.closest("[data-estado]");
    if (!btn) return;
    estado = btn.dataset.estado;
    hostEl.querySelectorAll("#snEstadoChips .chip").forEach(c => c.classList.toggle("on", c === btn));
  });

  const nameInput = hostEl.querySelector("#snName");
  const slugInput = hostEl.querySelector("#snSlug");
  nameInput.addEventListener("input", () => { if (!slugTouched) slugInput.value = _slugify(nameInput.value); });
  slugInput.addEventListener("input", () => { slugTouched = slugInput.value.length > 0; });

  hostEl.querySelector("#snCreateBtn").addEventListener("click", () => _submit().catch(console.error));

  async function _submit() {
    const name       = nameInput.value.trim();
    const slug       = slugInput.value.trim();
    const adminFirst = hostEl.querySelector("#snAdminFirst").value.trim();
    const adminLast  = hostEl.querySelector("#snAdminLast").value.trim();
    const adminEmail = hostEl.querySelector("#snAdminEmail").value.trim();
    const errEl      = hostEl.querySelector("#snError");
    const createBtn  = hostEl.querySelector("#snCreateBtn");

    errEl.textContent = "";
    if (!name)       { errEl.textContent = "El nombre del centro es obligatorio."; return; }
    if (!slug)       { errEl.textContent = "El slug es obligatorio."; return; }
    if (!adminFirst) { errEl.textContent = "El nombre del administrador es obligatorio."; return; }
    if (!adminLast)  { errEl.textContent = "Los apellidos son obligatorios."; return; }
    if (!adminEmail) { errEl.textContent = "El email del administrador es obligatorio."; return; }

    createBtn.disabled = true;
    createBtn.textContent = "Creando…";
    try {
      const body = { name, slug, type: tipo, status: estado, admin: { first_name: adminFirst, last_name: adminLast, email: adminEmail } };
      if (regimenFiscal) body.regimen_fiscal = regimenFiscal;
      if (sector) body.sector = sector;
      const data = await createTenant(body);
      onCreated(data?.tenant);
    } catch (err) {
      errEl.textContent = err?.message || "No se pudo crear el centro.";
      createBtn.disabled = false;
      createBtn.innerHTML = `${icon("check", { size: 16 })} Crear centro`;
    }
  }
}
