// mobileTeacherSheets.js — Bottom sheets for the mobile teacher panel.
// All functions receive their dependencies as explicit parameters.

import { renderStepsHtml, renderChatHtml, fmtTime, fmtDateFromKey } from "../js/session-drawer-render.js";
import { mtFetchSessionDetail, mtMarkReviewed, mtCreateTask, mtUploadAttachment } from "./mobileTeacherData.js";

const SVG_X = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const SVG_CLOCK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

function _esc(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _initials(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.[0] || "?");
}

// ── Sheet open / close ─────────────────────────────────────────────

export function openSheet(sheetEl, backdropEl) {
  backdropEl.classList.add("mt-backdrop--visible");
  requestAnimationFrame(() => sheetEl.classList.add("mt-sheet--visible"));
  document.body.style.overflow = "hidden";
}

export function closeSheet(sheetEl, backdropEl) {
  sheetEl.classList.remove("mt-sheet--visible");
  backdropEl.classList.remove("mt-backdrop--visible");
  document.body.style.overflow = "";
}

// ── Session detail sheet (tap a dot) ──────────────────────────────

export async function openSessionSheet({ sheetEl, backdropEl, sessionId, studentName, apiFetch }) {
  const contentEl = sheetEl.querySelector("#mtSheetContent");
  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <span class="mt-sheet-title">${_esc(studentName)}</span>
      <button class="mt-sheet-close" id="mtSheetClose">${SVG_X}</button>
    </div>
    <div class="mt-sheet-body"><div class="mt-loading">Cargando…</div></div>`;
  openSheet(sheetEl, backdropEl);
  sheetEl.querySelector("#mtSheetClose").addEventListener("click", () => closeSheet(sheetEl, backdropEl));
  backdropEl.addEventListener("click", () => closeSheet(sheetEl, backdropEl), { once: true });

  try {
    const data     = await mtFetchSessionDetail(apiFetch, sessionId);
    const session  = data.session  || {};
    const stepMap  = data.stepMap  || { steps: [], currentStep: 0 };
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const note     = data.note || null;

    const isCompleted = session.outcome === "completed" || session.outcome === "abandoned";
    let badgeCls = "mt-status--pend", badgeLabel = "Pendiente";
    if (session.needs_help || session.outcome === "abandoned") { badgeCls = "mt-status--help"; badgeLabel = "Necesitó ayuda"; }
    else if (session.outcome === "completed")                  { badgeCls = "mt-status--solo"; badgeLabel = "Resolvió solo"; }
    else if (session.outcome === "in_progress")                { badgeCls = "mt-status--warn"; badgeLabel = "En curso"; }

    const dateStr = session.session_date ? fmtDateFromKey(session.session_date) : "";
    const timeStr = session.duration_seconds ? fmtTime(session.duration_seconds) : "";

    const bodyEl = sheetEl.querySelector(".mt-sheet-body");
    bodyEl.innerHTML = `
      <span class="mt-status-badge ${badgeCls}">${_esc(badgeLabel)}</span>
      <div class="mt-sheet-meta">${dateStr}${timeStr ? ` · ${timeStr}` : ""}</div>
      ${note ? `<div class="mt-sheet-sect">
        <div class="mt-sheet-sect-label">Nota del alumno</div>
        <p class="mt-note-text">❝ ${_esc(note.note_text)}</p>
      </div>` : ""}
      <div class="mt-sheet-sect">
        <div class="mt-sheet-sect-label">Recorrido del ejercicio</div>
        ${renderStepsHtml(stepMap)}
      </div>
      <div class="mt-sheet-sect">
        <div class="mt-sheet-sect-label">Conversación</div>
        ${renderChatHtml(messages)}
      </div>`;

    if (isCompleted && !session.teacher_reviewed) {
      const foot = document.createElement("div");
      foot.className = "mt-sheet-footer";
      foot.innerHTML = `<button class="mt-btn mt-btn--primary" id="mtBtnRevisar" style="width:100%">Marcar como revisado</button>`;
      sheetEl.appendChild(foot);
      foot.querySelector("#mtBtnRevisar").addEventListener("click", async (e) => {
        e.target.disabled = true;
        e.target.textContent = "Guardando…";
        const ok = await mtMarkReviewed(apiFetch, sessionId).catch(() => false);
        e.target.textContent = ok ? "Revisado ✓" : "Error — reintentar";
        if (!ok) e.target.disabled = false;
      });
    }
  } catch {
    sheetEl.querySelector(".mt-sheet-body").innerHTML = `<div class="mt-loading">Error al cargar la sesión.</div>`;
  }
}

// ── Note sheet (tap note button on a student card) ─────────────────

export function openNoteSheet({ sheetEl, backdropEl, note, studentName }) {
  const contentEl = sheetEl.querySelector("#mtSheetContent");
  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <span class="mt-sheet-title">Nota de ${_esc(studentName)}</span>
      <button class="mt-sheet-close" id="mtSheetClose">${SVG_X}</button>
    </div>
    <div class="mt-sheet-body">
      <p class="mt-note-text" style="margin-bottom:10px">❝ ${_esc(note.note_text || note.text || "")}</p>
      ${note.task_title ? `<div class="mt-sheet-meta">Tarea: ${_esc(note.task_title)}</div>` : ""}
    </div>`;
  openSheet(sheetEl, backdropEl);
  sheetEl.querySelector("#mtSheetClose").addEventListener("click", () => closeSheet(sheetEl, backdropEl));
  backdropEl.addEventListener("click", () => closeSheet(sheetEl, backdropEl), { once: true });
}

// ── New task sheet (agenda + button) ──────────────────────────────

export function openNewTaskSheet({ sheetEl, backdropEl, groups, currentGroupId, apiFetch, onCreated }) {
  const contentEl = sheetEl.querySelector("#mtSheetContent");

  const groupOptions = groups.map(g => `<option value="${_esc(g.id)}" ${g.id === currentGroupId ? "selected" : ""}>${_esc(g.name)}</option>`).join("");

  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <span class="mt-sheet-title">Nueva <em style="font-family:var(--serif);font-style:italic;color:var(--copper)">tarea</em></span>
      <button class="mt-sheet-close" id="mtSheetClose">${SVG_X}</button>
    </div>
    <div class="mt-sheet-body">
      <div class="mt-form-field">
        <label class="mt-form-label">Tipo</label>
        <div class="mt-type-chips">
          <button type="button" class="mt-type-chip mt-type-chip--active" data-type="homework">Deberes</button>
          <button type="button" class="mt-type-chip" data-type="exam">Examen</button>
          <button type="button" class="mt-type-chip" data-type="work">Trabajo</button>
        </div>
      </div>
      <div class="mt-form-field">
        <label class="mt-form-label">Asignatura</label>
        <select class="mt-form-select" id="mtTaskGroup"><option value="">— Grupo —</option>${groupOptions}</select>
      </div>
      <div class="mt-form-field">
        <label class="mt-form-label">Título</label>
        <input type="text" class="mt-form-input" id="mtTaskTitle" placeholder="Ej. Derivadas · hoja 4">
      </div>
      <div class="mt-form-field">
        <label class="mt-form-label">Fecha de entrega</label>
        <input type="date" class="mt-form-input" id="mtTaskDate">
      </div>
      <div class="mt-form-field">
        <label class="mt-form-label">Nota para el alumno <span style="opacity:.5">(opcional)</span></label>
        <textarea class="mt-form-textarea" id="mtTaskNotes" placeholder="Instrucciones, página del libro, recordatorios…"></textarea>
      </div>
      <div class="mt-form-field">
        <label class="mt-form-label">Adjunto <span style="opacity:.5">(opcional)</span></label>
        <div class="mt-file-zone" id="mtFileZone" role="button" tabindex="0" aria-label="Adjuntar archivo">
          <span class="mt-file-zone-text" id="mtFileZoneText">Toca para adjuntar imagen o PDF</span>
        </div>
        <input type="file" id="mtFileInput" accept="image/*,application/pdf" style="display:none" aria-hidden="true">
      </div>
    </div>
    <div class="mt-sheet-footer">
      <div class="mt-sheet-footer-btns">
        <button type="button" class="mt-btn mt-btn--ghost" id="mtBtnBorrador">Borrador</button>
        <button type="button" class="mt-btn mt-btn--primary" id="mtBtnAsignar">Guardar</button>
      </div>
    </div>`;

  openSheet(sheetEl, backdropEl);
  const close = () => closeSheet(sheetEl, backdropEl);
  sheetEl.querySelector("#mtSheetClose").addEventListener("click", close);
  backdropEl.addEventListener("click", close, { once: true });

  let selectedType = "homework";
  contentEl.querySelectorAll(".mt-type-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      contentEl.querySelectorAll(".mt-type-chip").forEach(b => b.classList.remove("mt-type-chip--active"));
      btn.classList.add("mt-type-chip--active");
      selectedType = btn.dataset.type;
    });
  });

  let selectedFile = null;
  const fileZoneEl  = contentEl.querySelector("#mtFileZone");
  const fileInputEl = contentEl.querySelector("#mtFileInput");
  const fileTextEl  = contentEl.querySelector("#mtFileZoneText");
  fileZoneEl.addEventListener("click", () => fileInputEl.click());
  fileZoneEl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fileInputEl.click(); });
  fileInputEl.addEventListener("change", () => {
    selectedFile = fileInputEl.files[0] || null;
    fileTextEl.textContent = selectedFile ? selectedFile.name : "Toca para adjuntar imagen o PDF";
    fileZoneEl.classList.toggle("mt-file-zone--selected", !!selectedFile);
  });

  async function _submit(isDraft) {
    const title   = contentEl.querySelector("#mtTaskTitle").value.trim();
    const groupId = contentEl.querySelector("#mtTaskGroup").value;
    const dateVal = contentEl.querySelector("#mtTaskDate").value;
    const notes   = contentEl.querySelector("#mtTaskNotes").value.trim();
    if (!title || !groupId) {
      contentEl.querySelector("#mtTaskTitle").focus();
      return;
    }
    const btnEl = contentEl.querySelector(isDraft ? "#mtBtnBorrador" : "#mtBtnAsignar");
    btnEl.disabled = true;
    btnEl.textContent = "Guardando…";
    try {
      // dateVal comes from a plain <input type="date">: an already-local
      // "YYYY-MM-DD" string. Sent as-is — never built into a Date object,
      // which would otherwise be parsed as UTC and shift by a day in CEST/CET.
      const dueDate = dateVal || null;
      const task = await mtCreateTask(apiFetch, { title, type: selectedType, group_id: groupId, due_date: dueDate, teacher_notes: notes || null, is_draft: isDraft });
      if (selectedFile && task?.id) {
        await mtUploadAttachment(apiFetch, task.id, selectedFile).catch(() => {});
      }
      close();
      onCreated?.();
    } catch (err) {
      btnEl.disabled = false;
      btnEl.textContent = isDraft ? "Borrador" : "Guardar";
    }
  }

  contentEl.querySelector("#mtBtnBorrador").addEventListener("click", () => _submit(true));
  contentEl.querySelector("#mtBtnAsignar").addEventListener("click", () => _submit(false));
}
