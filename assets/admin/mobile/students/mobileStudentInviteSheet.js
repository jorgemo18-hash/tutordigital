// mobileStudentInviteSheet.js — "Invitar alumno" bottom sheet. Same 2-step
// group picker (course → single vía) and endpoint as desktop's
// adminAlumnos.js inviteStudentFromTab().

import { inviteStudent } from "../mobileAdminData.js";

const STAGE_KEYS  = ["primaria", "eso", "bachiller", "otros"];
const STAGE_LABEL = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato", otros: "Otros" };

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _inferStage(g) {
  const raw = String(g.level || g.stage || g.name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (raw.includes("prim")) return "primaria";
  if (raw.includes("eso") || raw.includes("secund")) return "eso";
  if (raw.includes("bach")) return "bachiller";
  return "otros";
}
function _inferYear(g) {
  const n = Number(g.year || 0);
  if (Number.isInteger(n) && n >= 1 && n <= 6) return n;
  const m = String(g.course || g.name || "").match(/\b([1-6])[ºo°]?/);
  return m ? Number(m[1]) : 0;
}
function _extractTrack(g) {
  if (g.track) return String(g.track).toUpperCase().trim();
  return String(g.name || "").trim().split(/\s+/).at(-1).toUpperCase();
}
function _coursesFromGroups(groups) {
  const seen = new Map();
  for (const g of groups) {
    const stage = _inferStage(g);
    const year  = _inferYear(g);
    if (!year) continue;
    const key = `${stage}|${year}`;
    if (!seen.has(key)) seen.set(key, { stage, year, key, label: `${STAGE_LABEL[stage] || stage} ${year}º` });
  }
  return [...seen.values()].sort((a, b) => {
    const si = STAGE_KEYS.indexOf(a.stage) - STAGE_KEYS.indexOf(b.stage);
    return si !== 0 ? si : a.year - b.year;
  });
}
function _groupLetter(g) {
  const s = _inferStage(g);
  return s === "bachiller" ? "B" : s === "eso" ? "E" : s === "primaria" ? "P" : "?";
}

export function renderStudentInviteSheet({ contentEl, fetchJSON, allGroups, onClose, onInvited }) {
  let pickerStep   = 0; // 0=closed picker(shows selection), 1=course, 2=via
  let pickerCourse = null;
  let selectedGroupId = null;

  function _pickerHtml() {
    if (pickerStep === 0) {
      const sel = selectedGroupId ? allGroups.find(g => g.id === selectedGroupId) : null;
      if (sel) {
        return `<div class="ad-row-card">
          <div class="ad-letter">${_esc(_groupLetter(sel))}</div>
          <span class="ad-list-row-name">${_esc(sel.name)}</span>
          <button class="ad-icon-btn" type="button" id="adSiClearGroup">×</button>
        </div>`;
      }
      return `<button class="ad-add-group-btn" type="button" id="adSiOpenPicker">Elegir grupo</button>`;
    }
    if (pickerStep === 1) {
      const courses = _coursesFromGroups(allGroups);
      const byStage = {};
      for (const c of courses) (byStage[c.stage] = byStage[c.stage] || []).push(c);
      return `<div class="ad-group-picker">
        <div class="ad-group-picker-head"><span class="ad-form-label">Elige el curso</span><button class="ad-icon-btn" type="button" id="adSiCancelPicker">×</button></div>
        ${STAGE_KEYS.filter(s => byStage[s]).map(s => `
          <div class="ad-form-field">
            <span class="ad-form-label">${_esc(STAGE_LABEL[s])}</span>
            <div class="ad-chip-row">${byStage[s].map(c => `<button type="button" class="ad-chip" data-pick-course="${c.stage}|${c.year}">${_esc(c.label)}</button>`).join("")}</div>
          </div>`).join("")}
      </div>`;
    }
    const vias = allGroups.filter(g => _inferStage(g) === pickerCourse.stage && _inferYear(g) === pickerCourse.year);
    return `<div class="ad-group-picker">
      <div class="ad-group-picker-head">
        <span class="ad-form-label">${_esc(pickerCourse.label)} — elige vía</span>
        <button class="ad-link-btn" type="button" id="adSiBackStep1">← Curso</button>
      </div>
      <div class="ad-chip-row">${vias.map(g => `<button type="button" class="ad-chip" data-pick-via="${_esc(g.id)}">${_esc(_extractTrack(g))}</button>`).join("")}</div>
    </div>`;
  }

  function draw() {
    const email = contentEl.querySelector("#adSiEmail")?.value || "";
    const firstName = contentEl.querySelector("#adSiFirst")?.value || "";
    const lastName  = contentEl.querySelector("#adSiLast")?.value || "";

    contentEl.innerHTML = `
      <div class="ad-sheet-header">
        <span class="ad-sheet-title">Invitar alumno</span>
        <button class="ad-sheet-close" id="adSiClose">×</button>
      </div>
      <div class="ad-sheet-body">
        <div class="ad-form-field"><label class="ad-form-label">Nombre *</label><input class="ad-form-input" id="adSiFirst" type="text" value="${_esc(firstName)}"></div>
        <div class="ad-form-field"><label class="ad-form-label">Apellidos *</label><input class="ad-form-input" id="adSiLast" type="text" value="${_esc(lastName)}"></div>
        <div class="ad-form-field"><label class="ad-form-label">Email *</label><input class="ad-form-input" id="adSiEmail" type="email" value="${_esc(email)}" placeholder="alumno@centro.com"></div>
        <div class="ad-form-field"><label class="ad-form-label">Grupo *</label><div id="adSiPicker">${_pickerHtml()}</div></div>
        <p class="ad-loading-line ad-loading-line--err" id="adSiError" style="display:none"></p>
      </div>
      <div class="ad-sheet-footer">
        <div class="ad-sheet-footer-btns">
          <button class="ad-btn ad-btn--ghost" type="button" id="adSiCancel">Cancelar</button>
          <button class="ad-btn ad-btn--primary" type="button" id="adSiSend" disabled>Enviar invitación</button>
        </div>
      </div>`;

    contentEl.querySelector("#adSiClose").addEventListener("click", onClose);
    contentEl.querySelector("#adSiCancel").addEventListener("click", onClose);
    ["adSiFirst", "adSiLast", "adSiEmail"].forEach(id => contentEl.querySelector(`#${id}`).addEventListener("input", _refreshSend));
    contentEl.querySelector("#adSiSend").addEventListener("click", () => _submit().catch(console.error));

    contentEl.querySelector("#adSiOpenPicker")?.addEventListener("click", () => { pickerStep = 1; draw(); });
    contentEl.querySelector("#adSiClearGroup")?.addEventListener("click", () => { selectedGroupId = null; draw(); });
    contentEl.querySelector("#adSiCancelPicker")?.addEventListener("click", () => { pickerStep = 0; pickerCourse = null; draw(); });
    contentEl.querySelector("#adSiBackStep1")?.addEventListener("click", () => { pickerStep = 1; pickerCourse = null; draw(); });
    contentEl.querySelectorAll("[data-pick-course]").forEach(btn => btn.addEventListener("click", () => {
      const [stage, yearStr] = btn.dataset.pickCourse.split("|");
      pickerCourse = { stage, year: Number(yearStr), label: `${STAGE_LABEL[stage] || stage} ${yearStr}º` };
      pickerStep = 2;
      draw();
    }));
    contentEl.querySelectorAll("[data-pick-via]").forEach(btn => btn.addEventListener("click", () => {
      selectedGroupId = btn.dataset.pickVia;
      pickerStep = 0; pickerCourse = null;
      draw();
    }));

    _refreshSend();
  }

  function _refreshSend() {
    const email = contentEl.querySelector("#adSiEmail")?.value.trim() || "";
    const firstName = contentEl.querySelector("#adSiFirst")?.value.trim() || "";
    const lastName  = contentEl.querySelector("#adSiLast")?.value.trim() || "";
    const sendBtn = contentEl.querySelector("#adSiSend");
    if (sendBtn) sendBtn.disabled = !(email.includes("@") && firstName && lastName && selectedGroupId);
  }

  async function _submit() {
    const email = contentEl.querySelector("#adSiEmail").value.trim().toLowerCase();
    const first_name = contentEl.querySelector("#adSiFirst").value.trim();
    const last_name  = contentEl.querySelector("#adSiLast").value.trim();
    const errEl = contentEl.querySelector("#adSiError");
    const sendBtn = contentEl.querySelector("#adSiSend");
    if (!email || !first_name || !last_name || !selectedGroupId) return;

    sendBtn.disabled = true;
    sendBtn.textContent = "Enviando…";
    errEl.style.display = "none";
    try {
      await inviteStudent(fetchJSON, selectedGroupId, { email, first_name, last_name });
      onInvited();
    } catch (err) {
      errEl.textContent = err?.message || "No se pudo crear la invitación.";
      errEl.style.display = "block";
      sendBtn.disabled = false;
      sendBtn.textContent = "Enviar invitación";
    }
  }

  draw();
}
