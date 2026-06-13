import { escHtml, uniq, fetchJSON } from "./adminUtils.js";
import {
  groupLetter, groupMeta,
  renderAssignBlock, buildPayload, STAGE_LABEL,
} from "./adminTeacherEntryBlock.js";

const DEFAULT_SUBJECTS = [
  "Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología",
  "Historia", "Geografía", "Filosofía", "Economía", "Tecnología",
  "Música", "Educación Física", "Plástica", "Francés",
];

export function initTeacherDrawer({ state, reloadTeachers }) {

  // ── State ────────────────────────────────────────────────────────────────

  let currentTeacher  = null;
  let drawerEntries   = [];  // [{groupId, groupName, groupLetter, groupMeta, selectedSubjects: Set, isTutor: bool}]
  let expandedGroupId = null;
  let pickerStep      = 0;
  let pickerCourse    = null;
  let pickerTrackSet  = new Set();

  // ── HTML ──────────────────────────────────────────────────────────────────

  const overlay = document.createElement("div");
  overlay.className = "av-drawer-overlay";
  overlay.id = "teacherEditDrawer";
  overlay.innerHTML = `
    <div class="av-drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
      <div class="av-drawer-head">
        <div class="av-drawer-head-info">
          <div class="av-drawer-title" id="drawerTitle">Docente</div>
          <div class="av-drawer-sub"  id="drawerSub"></div>
        </div>
        <button class="av-icon-btn" id="closeDrawerBtn" type="button" title="Cerrar">×</button>
      </div>
      <div class="av-drawer-body">
        <div class="av-field">
          <label class="av-label" for="drawerName">Nombre completo</label>
          <input class="av-input" id="drawerName" type="text" autocomplete="name" />
        </div>
        <div class="av-field">
          <label class="av-label" for="drawerEmail">Email</label>
          <input class="av-input" id="drawerEmail" type="email" autocomplete="email" />
          <p class="av-field-warn">Cambiar el email modifica el acceso del docente a la plataforma</p>
        </div>
        <div class="av-field">
          <span class="av-label">Grupos y asignaturas</span>
          <div id="drawerAssignBlock"></div>
        </div>
        <div class="av-field">
          <label class="av-label" for="drawerStatus">Estado</label>
          <select class="av-input" id="drawerStatus">
            <option value="active">Activo</option>
            <option value="revoked">Revocado</option>
          </select>
        </div>
        <div id="drawerMsg" class="av-drawer-msg" hidden></div>
      </div>
      <div class="av-drawer-foot">
        <div class="av-drawer-foot-left">
          <button class="btn danger" id="drawerRevokeBtn" type="button">Revocar acceso</button>
        </div>
        <div class="av-drawer-foot-right">
          <button class="btn ghost"   id="drawerCancelBtn" type="button">Cancelar</button>
          <button class="btn primary" id="drawerSaveBtn"   type="button">Guardar cambios</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // ── DOM refs ──────────────────────────────────────────────────────────────

  const titleEl     = overlay.querySelector("#drawerTitle");
  const subEl       = overlay.querySelector("#drawerSub");
  const nameInput   = overlay.querySelector("#drawerName");
  const emailInput  = overlay.querySelector("#drawerEmail");
  const statusSel   = overlay.querySelector("#drawerStatus");
  const assignBlock = overlay.querySelector("#drawerAssignBlock");
  const msgEl       = overlay.querySelector("#drawerMsg");
  const saveBtn     = overlay.querySelector("#drawerSaveBtn");

  // ── Helpers ───────────────────────────────────────────────────────────────

  function allGroups() {
    return state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);
  }

  function subjectCatalog() {
    const fromTeachers = (state.teachers || []).flatMap(t => t.subjects || []);
    return uniq([...DEFAULT_SUBJECTS, ...fromTeachers]).sort((a, b) => a.localeCompare(b, "es"));
  }

  function showMsg(text, type = "error") {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = `av-drawer-msg ${type}`;
    msgEl.hidden = !text;
  }

  function clearMsg() { showMsg(""); }

  function rebuildBlock() {
    const addedIds    = new Set(drawerEntries.map(e => e.groupId));
    const available   = allGroups().filter(g => !addedIds.has(g.id));
    renderAssignBlock(assignBlock, {
      entries:         drawerEntries,
      availableGroups: available,
      subjects:        subjectCatalog(),
      expandedGroupId,
      pickerStep,
      pickerCourse,
      pickerTrackSet,
      showIsTutor: true,
    });
  }

  // ── Open / close ──────────────────────────────────────────────────────────

  function open(teacher) {
    currentTeacher = teacher;
    titleEl.textContent = teacher.display_name || teacher.email || "Docente";
    subEl.textContent   = teacher.email || "";
    nameInput.value     = teacher.display_name || "";
    emailInput.value    = teacher.email || "";
    statusSel.value     = teacher.is_active === false ? "revoked" : "active";

    const groups = allGroups();
    drawerEntries = (teacher.groups || []).map(tg => {
      const full = groups.find(g => g.id === tg.id) || tg;
      return {
        groupId:          tg.id,
        groupName:        tg.name || tg.id,
        groupLetter:      groupLetter(full),
        groupMeta:        groupMeta(full),
        selectedSubjects: new Set(tg.subjects || []),
        isTutor:          Boolean(tg.is_tutor),
      };
    });

    expandedGroupId = null;
    pickerStep      = 0;
    pickerCourse    = null;
    pickerTrackSet  = new Set();
    rebuildBlock();
    clearMsg();
    overlay.classList.add("open");
    nameInput.focus();
  }

  function close() {
    overlay.classList.remove("open");
    currentTeacher  = null;
    drawerEntries   = [];
    expandedGroupId = null;
    pickerStep      = 0;
    clearMsg();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!currentTeacher?.id) return;
    clearMsg();
    saveBtn.disabled = true;
    try {
      const display_name = nameInput.value.trim();
      const email        = emailInput.value.trim().toLowerCase();
      if (!display_name)              { showMsg("El nombre no puede estar vacío."); return; }
      if (!email || !email.includes("@")) { showMsg("Email inválido."); return; }

      const { assignments, group_ids, tutor_group_ids } = buildPayload(drawerEntries);
      const body = {
        display_name,
        email,
        is_active:      statusSel.value === "active",
        assignments,
        group_ids,
        tutor_group_ids,
      };

      await fetchJSON(`/api/v1/admin/teachers/${currentTeacher.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      close();
      await reloadTeachers();
    } catch (err) {
      showMsg(err?.message || "No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  async function revoke() {
    if (!currentTeacher?.id) return;
    const name = currentTeacher.display_name || currentTeacher.email || "este docente";
    if (!window.confirm(`¿Seguro que quieres revocar el acceso de ${name}?`)) return;
    clearMsg();
    try {
      await fetchJSON(`/api/v1/admin/teachers/${currentTeacher.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ is_active: false }),
      });
      close();
      await reloadTeachers();
    } catch (err) {
      showMsg(err?.message || "No se pudo revocar el acceso.");
    }
  }

  // ── Assign block event delegation ─────────────────────────────────────────

  assignBlock.addEventListener("click", ev => {
    const removeBtn = ev.target.closest("[data-ab-remove]");
    if (removeBtn) {
      drawerEntries = drawerEntries.filter(e => e.groupId !== removeBtn.dataset.abRemove);
      rebuildBlock();
      return;
    }
    const expandEl = ev.target.closest("[data-ab-expand]");
    if (expandEl) {
      const id = expandEl.dataset.abExpand;
      expandedGroupId = expandedGroupId === id ? null : id;
      rebuildBlock();
      return;
    }
    const subjectChip = ev.target.closest("[data-ab-subject]");
    if (subjectChip) {
      const entry = drawerEntries.find(e => e.groupId === subjectChip.dataset.abGroup);
      if (entry) {
        const s = subjectChip.dataset.abSubject;
        if (entry.selectedSubjects.has(s)) entry.selectedSubjects.delete(s);
        else entry.selectedSubjects.add(s);
        subjectChip.classList.toggle("active", entry.selectedSubjects.has(s));
        const countEl = assignBlock.querySelector(`[data-ab-subject-count="${entry.groupId}"]`);
        if (countEl) {
          const n = entry.selectedSubjects.size;
          countEl.textContent = n === 0 ? "Ninguna seleccionada" : n === 1 ? "1 seleccionada" : `${n} seleccionadas`;
        }
      }
      return;
    }
    if (ev.target.closest("[data-ab-open-picker]"))  { pickerStep = 1; rebuildBlock(); return; }
    const courseChip = ev.target.closest("[data-ab-pick-course]");
    if (courseChip) {
      const [stage, yearStr] = courseChip.dataset.abPickCourse.split("|");
      pickerCourse   = { stage, year: Number(yearStr), label: `${STAGE_LABEL[stage] || stage} ${Number(yearStr)}º` };
      pickerTrackSet = new Set();
      pickerStep     = 2;
      rebuildBlock();
      return;
    }
    const trackChip = ev.target.closest("[data-ab-pick-track]");
    if (trackChip) {
      const id = trackChip.dataset.abPickTrack;
      if (pickerTrackSet.has(id)) pickerTrackSet.delete(id); else pickerTrackSet.add(id);
      rebuildBlock();
      return;
    }
    if (ev.target.closest("[data-ab-confirm-tracks]")) {
      const addedIds  = new Set(drawerEntries.map(e => e.groupId));
      const available = allGroups().filter(g => !addedIds.has(g.id));
      let firstNew = null;
      for (const id of pickerTrackSet) {
        const g = available.find(x => x.id === id);
        if (g) {
          drawerEntries.push({
            groupId: g.id, groupName: g.name || g.id,
            groupLetter: groupLetter(g), groupMeta: groupMeta(g),
            selectedSubjects: new Set(), isTutor: false,
          });
          firstNew = firstNew || g.id;
        }
      }
      pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set();
      expandedGroupId = firstNew; // expand first new group for immediate subject selection
      rebuildBlock();
      return;
    }
    if (ev.target.closest("[data-ab-back-step1]"))   { pickerStep = 1; pickerCourse = null; pickerTrackSet = new Set(); rebuildBlock(); return; }
    if (ev.target.closest("[data-ab-cancel-picker]")) { pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set(); rebuildBlock(); return; }
  });

  assignBlock.addEventListener("change", ev => {
    const toggle = ev.target.closest("[data-ab-is-tutor]");
    if (!toggle) return;
    const entry = drawerEntries.find(e => e.groupId === toggle.dataset.abIsTutor);
    if (entry) entry.isTutor = toggle.checked;
  });

  // ── Wire teacher list rows ────────────────────────────────────────────────

  overlay.addEventListener("click", ev => { if (ev.target === overlay) close(); });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) close();
  });
  overlay.querySelector("#closeDrawerBtn")?.addEventListener("click", close);
  overlay.querySelector("#drawerCancelBtn")?.addEventListener("click", close);
  overlay.querySelector("#drawerSaveBtn")?.addEventListener("click", () => save().catch(console.error));
  overlay.querySelector("#drawerRevokeBtn")?.addEventListener("click", () => revoke().catch(console.error));

  const teachersList = document.getElementById("teachersList");
  teachersList?.addEventListener("click", ev => {
    if (ev.target.closest("button")) return;
    const row = ev.target.closest("[data-teacher-key]");
    if (!row) return;
    const teacher = (state.teachers || []).find(t => (t.id || t.email) === row.dataset.teacherKey);
    if (!teacher?.id) return;
    open(teacher);
  });

  const styleTag = document.createElement("style");
  styleTag.textContent = `
    #teachersList .av-doc-row { cursor: pointer; transition: background 0.12s; }
    #teachersList .av-doc-row:hover { background: rgba(196,131,74,0.06); }
    .av-assign-entry--collapsed { cursor: pointer; }
    .av-assign-entry--collapsed:hover .av-assign-summary { background: rgba(196,131,74,0.06); }
    .av-assign-summary { display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: 14px; padding: 10px 14px; border-radius: 10px; background: var(--glass-strong); border: 1px solid var(--hairline); transition: background .12s; }
    .av-assign-summary-text { display: flex; flex-direction: column; gap: 2px; }
    .av-assign-item--clickable { cursor: pointer; transition: background .12s; }
    .av-assign-item--clickable:hover { background: rgba(196,131,74,0.06); }
    .av-tutor-badge { display: inline-block; font-size: 10px; background: rgba(196,131,74,0.14); color: var(--copper-soft); border-radius: 100px; padding: 2px 6px; margin-left: 4px; vertical-align: middle; font-weight: 500; }
    .av-tutor-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-mute); cursor: pointer; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--hairline); }
    .av-tutor-toggle input { accent-color: var(--copper, #c4834a); }
  `;
  document.head.appendChild(styleTag);

  return { open, close };
}
