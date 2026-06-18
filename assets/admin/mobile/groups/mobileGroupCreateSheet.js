// mobileGroupCreateSheet.js — "Nuevo grupo" bottom sheet. Same flow and
// endpoint as desktop's adminCreateGroupForm.js (stage → year → tracks →
// preview → create one POST per track), adapted to a mobile sheet.

import { createGroup } from "../mobileAdminData.js";

const STAGE_YEARS  = { primaria: [1, 2, 3, 4, 5, 6], eso: [1, 2, 3, 4], bachiller: [1, 2] };
const STAGE_LABELS = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato" };
const FIXED_TRACKS = ["A", "B", "C", "D", "NEAE", "PAI"];

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function _autoName(stage, year, track) { return `${year}º ${STAGE_LABELS[stage]} ${track}`; }

export function renderGroupCreateSheet({ contentEl, fetchJSON, onClose, onCreated }) {
  let stage = null;
  let year  = null;
  const selectedTracks = new Set();
  const customTracks   = [];

  function allTracks() { return [...FIXED_TRACKS.filter(t => selectedTracks.has(t)), ...customTracks.filter(Boolean)]; }

  function draw() {
    const tracks   = allTracks();
    const canShowPreview = stage && year && tracks.length;

    contentEl.innerHTML = `
      <div class="ad-sheet-header">
        <span class="ad-sheet-title">Nuevo grupo</span>
        <button class="ad-sheet-close" id="adGcClose">×</button>
      </div>
      <div class="ad-sheet-body">
        <div class="ad-form-field">
          <label class="ad-form-label">Etapa</label>
          <div class="ad-chip-row">
            ${["primaria", "eso", "bachiller"].map(s => `<button type="button" class="ad-chip${stage === s ? " ad-chip--active" : ""}" data-stage="${s}">${STAGE_LABELS[s]}</button>`).join("")}
          </div>
        </div>
        ${stage ? `
        <div class="ad-form-field">
          <label class="ad-form-label">Curso</label>
          <div class="ad-chip-row">
            ${STAGE_YEARS[stage].map(y => `<button type="button" class="ad-chip${year === y ? " ad-chip--active" : ""}" data-year="${y}">${y}º</button>`).join("")}
          </div>
        </div>` : ""}
        ${stage && year ? `
        <div class="ad-form-field">
          <label class="ad-form-label">Vías <span class="ad-form-hint">(selección múltiple)</span></label>
          <div class="ad-chip-row">
            ${FIXED_TRACKS.map(t => `<button type="button" class="ad-chip${selectedTracks.has(t) ? " ad-chip--active" : ""}" data-track="${t}">${t}</button>`).join("")}
            <button type="button" class="ad-chip" id="adGcOtro">Otro…</button>
          </div>
          <div id="adGcCustom">${customTracks.map((t, i) => `
            <div class="ad-custom-track-row">
              <input class="ad-form-input" type="text" maxlength="32" value="${_esc(t)}" data-custom-idx="${i}" placeholder="Ej. REFUERZO, PMAR…">
              <button type="button" class="ad-icon-btn" data-remove-custom="${i}">×</button>
            </div>`).join("")}</div>
        </div>` : ""}
        ${canShowPreview ? `
        <div class="ad-form-field">
          <label class="ad-form-label">Grupos a crear</label>
          <div id="adGcPreview">${tracks.map((t, i) => `
            <div class="ad-preview-row">
              <span class="ad-preview-idx">${i + 1}.</span>
              <input class="ad-form-input" type="text" value="${_esc(_autoName(stage, year, t))}" data-preview-idx="${i}">
            </div>`).join("")}</div>
        </div>` : ""}
        <p class="ad-loading-line ad-loading-line--err" id="adGcError" style="display:none"></p>
      </div>
      <div class="ad-sheet-footer">
        <button class="ad-btn ad-btn--primary" type="button" id="adGcSubmit" style="width:100%"${canShowPreview ? "" : " disabled"}>
          ${tracks.length > 1 ? `Crear ${tracks.length} grupos` : "Crear grupo"}
        </button>
      </div>`;

    contentEl.querySelector("#adGcClose").addEventListener("click", onClose);

    contentEl.querySelectorAll("[data-stage]").forEach(btn => btn.addEventListener("click", () => {
      stage = btn.dataset.stage; year = null; selectedTracks.clear(); customTracks.length = 0;
      draw();
    }));
    contentEl.querySelectorAll("[data-year]").forEach(btn => btn.addEventListener("click", () => {
      year = Number(btn.dataset.year); selectedTracks.clear(); customTracks.length = 0;
      draw();
    }));
    contentEl.querySelectorAll("[data-track]").forEach(btn => btn.addEventListener("click", () => {
      const t = btn.dataset.track;
      if (selectedTracks.has(t)) selectedTracks.delete(t); else selectedTracks.add(t);
      draw();
    }));
    contentEl.querySelector("#adGcOtro")?.addEventListener("click", () => { customTracks.push(""); draw(); });
    contentEl.querySelectorAll("[data-remove-custom]").forEach(btn => btn.addEventListener("click", () => {
      customTracks.splice(Number(btn.dataset.removeCustom), 1);
      draw();
    }));
    contentEl.querySelectorAll("[data-custom-idx]").forEach(inp => inp.addEventListener("input", () => {
      customTracks[Number(inp.dataset.customIdx)] = inp.value.trim();
    }));

    contentEl.querySelector("#adGcSubmit")?.addEventListener("click", () => _submit().catch(console.error));
  }

  async function _submit() {
    const tracks = allTracks();
    if (!stage || !year || !tracks.length) return;
    const names = Array.from(contentEl.querySelectorAll("[data-preview-idx]")).map(i => i.value.trim());
    const errEl = contentEl.querySelector("#adGcError");
    const submitBtn = contentEl.querySelector("#adGcSubmit");
    if (names.some(n => !n)) { errEl.textContent = "Todos los grupos deben tener nombre."; errEl.style.display = "block"; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creando…";
    errEl.style.display = "none";

    const created = [];
    const errors  = [];
    for (let i = 0; i < tracks.length; i++) {
      try {
        const res = await createGroup(fetchJSON, { name: names[i], stage, year, track: tracks[i] });
        created.push(res?.group || res);
      } catch (err) {
        errors.push(`${names[i]}: ${err?.message || "error"}`);
      }
    }

    if (!created.length) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Crear grupo";
      errEl.textContent = errors.join(" · ");
      errEl.style.display = "block";
      return;
    }
    onCreated(created, errors);
  }

  draw();
}
