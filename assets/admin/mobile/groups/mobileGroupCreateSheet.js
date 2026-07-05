// mobileGroupCreateSheet.js — "Nuevo grupo" bottom sheet. Same flow and
// endpoint as desktop's adminCreateGroupForm.js (stage → year → tracks →
// preview → create one POST per track). Structure/classes match the
// reference design's NuevoGrupoSheet exactly.

import { createGroup } from "../mobileAdminData.js";
import { icon } from "../mobileAdminIcons.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

const STAGE_YEARS  = { primaria: [1, 2, 3, 4, 5, 6], eso: [1, 2, 3, 4], bachiller: [1, 2] };
const STAGE_LABELS = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato" };
const FIXED_TRACKS = ["A", "B", "C", "D", "NEAE", "PAI"];

function _autoName(stage, year, track) { return `${year}º ${STAGE_LABELS[stage]} ${track}`; }

export function renderGroupCreateSheet({ contentEl, fetchJSON, onClose, onCreated }) {
  let stage = "primaria";
  let year  = STAGE_YEARS.primaria[0];
  const selectedTracks = new Set(["A"]);

  function draw() {
    const tracks = [...selectedTracks];
    const preview = tracks.map(t => _autoName(stage, year, t));

    contentEl.innerHTML = `
      <div class="sheet-head">
        <div class="sheet-title">Nuevo <em>grupo</em></div>
        <button type="button" class="iconbtn" id="adGcClose" aria-label="Cerrar">${icon("close", { size: 20 })}</button>
      </div>
      <div class="sheet-body">
        <div>
          <label class="field-label">Etapa</label>
          <div class="seg-etapa">
            ${["primaria", "eso", "bachiller"].map(s => `<button type="button" class="${stage === s ? "on" : ""}" data-stage="${s}">${STAGE_LABELS[s]}</button>`).join("")}
          </div>
        </div>
        <div>
          <label class="field-label">Curso</label>
          <div class="curso-grid">
            ${STAGE_YEARS[stage].map(y => `<button type="button" class="curso-chip ${year === y ? "on" : ""}" data-year="${y}">${y}º</button>`).join("")}
          </div>
        </div>
        <div>
          <label class="field-label">Vías <span style="color:var(--ink-faint)">· selección múltiple</span></label>
          <div class="pickline-chips">
            ${FIXED_TRACKS.map(t => `<button type="button" class="chip ${selectedTracks.has(t) ? "on" : ""}" data-track="${t}">${t}</button>`).join("")}
          </div>
        </div>
        ${preview.length ? `
        <div>
          <label class="field-label">Grupos a crear</label>
          <div class="preview-list">
            ${preview.map((p, i) => `
              <div class="preview-row">
                <span class="preview-n">${i + 1}.</span>
                <input class="preview-name" type="text" value="${_esc(p)}" data-preview-idx="${i}">
              </div>`).join("")}
          </div>
        </div>` : ""}
        <p class="sheet-error" id="adGcError" style="display:none"></p>
      </div>
      <div class="sheet-foot">
        <button type="button" class="btn btn-ghost" id="adGcCancel">Cancelar</button>
        <button type="button" class="btn btn-primary" id="adGcSubmit"${preview.length ? "" : " disabled"}>
          ${icon("check", { size: 16 })} Crear ${preview.length} ${preview.length === 1 ? "grupo" : "grupos"}
        </button>
      </div>`;

    contentEl.querySelector("#adGcClose").addEventListener("click", onClose);
    contentEl.querySelector("#adGcCancel").addEventListener("click", onClose);

    contentEl.querySelectorAll("[data-stage]").forEach(btn => btn.addEventListener("click", () => {
      stage = btn.dataset.stage; year = STAGE_YEARS[stage][0];
      draw();
    }));
    contentEl.querySelectorAll("[data-year]").forEach(btn => btn.addEventListener("click", () => {
      year = Number(btn.dataset.year);
      draw();
    }));
    contentEl.querySelectorAll("[data-track]").forEach(btn => btn.addEventListener("click", () => {
      const t = btn.dataset.track;
      if (selectedTracks.has(t)) selectedTracks.delete(t); else selectedTracks.add(t);
      draw();
    }));
    contentEl.querySelector("#adGcSubmit")?.addEventListener("click", () => _submit().catch(console.error));
  }

  async function _submit() {
    const tracks = [...selectedTracks];
    if (!stage || !year || !tracks.length) return;
    const names = Array.from(contentEl.querySelectorAll("[data-preview-idx]")).map(i => i.value.trim());
    const errEl = contentEl.querySelector("#adGcError");
    const submitBtn = contentEl.querySelector("#adGcSubmit");
    if (names.some(n => !n)) { errEl.textContent = "Todos los grupos deben tener nombre."; errEl.style.display = "block"; return; }

    submitBtn.disabled = true;
    errEl.style.display = "none";

    const created = [];
    const errors  = [];
    for (let i = 0; i < tracks.length; i++) {
      try {
        const res = await createGroup(fetchJSON, { name: names[i], stage, year, track: tracks[i] });
        created.push(res?.group ? { ...res.group, _freshJoinCode: res.join_code } : res);
      } catch (err) {
        errors.push(`${names[i]}: ${err?.message || "error"}`);
      }
    }

    if (!created.length) {
      submitBtn.disabled = false;
      errEl.textContent = errors.join(" · ");
      errEl.style.display = "block";
      return;
    }
    onCreated(created, errors);
  }

  draw();
}
