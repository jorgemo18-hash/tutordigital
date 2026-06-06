import { escHtml, uniq, fetchJSON } from "./adminUtils.js";

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SUBJECTS = [
  "Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología",
  "Historia", "Geografía", "Filosofía", "Economía", "Tecnología",
  "Música", "Educación Física", "Plástica", "Francés",
];

const STAGE_KEYS  = ["primaria", "eso", "bachiller", "otros"];
const STAGE_LABEL = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato", otros: "Otros" };

// ── Group helpers (mirrors adminTeachers.js) ───────────────────────────────

function groupLetter(g) {
  const level = String(g.level || g.stage || "").toLowerCase();
  if (level.includes("bach")) return "B";
  if (level.includes("eso") || level.includes("secund")) return "E";
  if (level.includes("prima")) return "P";
  return (g.name || "?")[0].toUpperCase();
}

function groupMeta(g) {
  const parts = [g.level, g.course].filter(Boolean);
  if (g.students != null) parts.push(`${g.students} alumnos`);
  return parts.join(" · ");
}

function inferStageFromGroup(g) {
  const raw = String(g.level || g.stage || g.name || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (raw.includes("prim")) return "primaria";
  if (raw.includes("eso") || raw.includes("secund")) return "eso";
  if (raw.includes("bach")) return "bachiller";
  return "otros";
}

function inferYearFromGroup(g) {
  const fromField = Number(g.year || 0);
  if (Number.isInteger(fromField) && fromField >= 1 && fromField <= 6) return fromField;
  const m = String(g.course || g.name || "").match(/\b([1-6])[ºo°]?/);
  return m ? Number(m[1]) : 0;
}

function extractTrack(g) {
  if (g.track) return String(g.track).toUpperCase().trim();
  const norm = String(g.normalized_name || "");
  if (norm.includes("|")) {
    const last = norm.split("|").at(-1).toUpperCase().trim();
    if (last) return last;
  }
  return String(g.name || "").trim().split(/\s+/).at(-1).toUpperCase();
}

function coursesFromGroups(groups) {
  const seen = new Map();
  for (const g of groups) {
    const stage = inferStageFromGroup(g);
    const year  = inferYearFromGroup(g);
    if (!year) continue;
    const key = `${stage}|${year}`;
    if (!seen.has(key)) {
      seen.set(key, { stage, year, key, label: `${STAGE_LABEL[stage] || stage} ${year}º` });
    }
  }
  return [...seen.values()].sort((a, b) => {
    const si = STAGE_KEYS.indexOf(a.stage) - STAGE_KEYS.indexOf(b.stage);
    return si !== 0 ? si : a.year - b.year;
  });
}

function groupsForCourse(groups, stage, year) {
  return groups.filter(g => inferStageFromGroup(g) === stage && inferYearFromGroup(g) === year);
}

// ── Drawer factory ─────────────────────────────────────────────────────────

export function initTeacherDrawer({ state, reloadTeachers }) {

  // ── Drawer state ────────────────────────────────────────────────────────

  let currentTeacher = null;
  let drawerGroupEntries = [];  // [{groupId, groupName, groupLetter, groupMeta, selectedSubjects: Set}]
  let pickerStep     = 0;       // 0=closed, 1=course, 2=track
  let pickerCourse   = null;    // {stage, year, label}
  let pickerTrackSet = new Set();

  // ── Overlay HTML ─────────────────────────────────────────────────────────

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
          <button class="btn ghost"    id="drawerCancelBtn" type="button">Cancelar</button>
          <button class="btn primary"  id="drawerSaveBtn"   type="button">Guardar cambios</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // ── DOM refs ─────────────────────────────────────────────────────────────

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

  // ── Assign block renderer ─────────────────────────────────────────────────

  function renderAssignBlock() {
    if (!assignBlock) return;

    const addedIds = new Set(drawerGroupEntries.map(e => e.groupId));
    const available = allGroups().filter(g => !addedIds.has(g.id));
    const subjects  = subjectCatalog();

    const cardsHtml = drawerGroupEntries.map(entry => {
      const count = entry.selectedSubjects.size;
      const countLabel = count === 0 ? "Ninguna seleccionada"
        : count === 1 ? "1 seleccionada"
        : `${count} seleccionadas`;
      const chipsHtml = subjects.map(s => {
        const active = entry.selectedSubjects.has(s) ? " active" : "";
        return `<span class="av-subject-chip${active}" data-dr-subject="${escHtml(s)}" data-dr-group-id="${escHtml(entry.groupId)}">${escHtml(s)}</span>`;
      }).join("");
      return `
        <div class="av-assign-entry" data-dr-entry="${escHtml(entry.groupId)}">
          <div class="av-assign-item">
            <div class="av-letter">${escHtml(entry.groupLetter)}</div>
            <div>
              <div class="av-assign-name">${escHtml(entry.groupName)}</div>
              ${entry.groupMeta ? `<div class="av-assign-sub">${escHtml(entry.groupMeta)}</div>` : ""}
            </div>
            <button class="av-icon-btn danger" data-dr-remove="${escHtml(entry.groupId)}" type="button" title="Quitar grupo">×</button>
          </div>
          <div class="av-assign-subjects">
            <div class="av-assign-subjects-head">
              <span class="av-label">Asignaturas que impartirá</span>
              <span class="av-row-meta">${escHtml(countLabel)}</span>
            </div>
            <div class="av-subject-pick">${chipsHtml}</div>
          </div>
        </div>`;
    }).join("");

    let selectorHtml = "";

    if (pickerStep === 1) {
      const courses = coursesFromGroups(available);
      if (!courses.length) {
        selectorHtml = `
          <div class="av-group-picker">
            <div class="av-group-picker-head">
              <span class="av-label">Añadir grupo</span>
              <button class="av-icon-btn" data-dr-cancel-picker type="button" title="Cerrar">×</button>
            </div>
            <p class="av-no-assign">Todos los grupos han sido añadidos.</p>
          </div>`;
      } else {
        const byStage = {};
        for (const c of courses) (byStage[c.stage] = byStage[c.stage] || []).push(c);
        const stagesHtml = STAGE_KEYS.filter(s => byStage[s]).map(s => {
          const chips = byStage[s].map(c =>
            `<span class="av-subject-chip" data-dr-pick-course="${escHtml(c.key)}">${escHtml(c.label)}</span>`
          ).join("");
          return `<div class="av-group-picker-stage">
            <span class="av-label">${escHtml(STAGE_LABEL[s])}</span>
            <div class="av-subject-pick">${chips}</div>
          </div>`;
        }).join("");
        selectorHtml = `
          <div class="av-group-picker">
            <div class="av-group-picker-head">
              <span class="av-label">Elige el curso</span>
              <button class="av-icon-btn" data-dr-cancel-picker type="button" title="Cerrar">×</button>
            </div>
            ${stagesHtml}
          </div>`;
      }

    } else if (pickerStep === 2 && pickerCourse) {
      const courseGroups = groupsForCourse(available, pickerCourse.stage, pickerCourse.year);
      const trackChips = courseGroups.map(g => {
        const track  = extractTrack(g);
        const active = pickerTrackSet.has(g.id) ? " active" : "";
        return `<span class="av-subject-chip${active}" data-dr-pick-track="${escHtml(g.id)}" title="${escHtml(g.name)}">${escHtml(track)}</span>`;
      }).join("");
      const canConfirm = pickerTrackSet.size > 0;
      selectorHtml = `
        <div class="av-group-picker">
          <div class="av-group-picker-head">
            <span class="av-label">${escHtml(pickerCourse.label)} — elige vías</span>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn ghost small" data-dr-back-step1 type="button">← Curso</button>
              <button class="av-icon-btn" data-dr-cancel-picker type="button" title="Cerrar">×</button>
            </div>
          </div>
          <div class="av-subject-pick">${trackChips}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:4px">
            <button class="btn primary small" data-dr-confirm-tracks type="button"${canConfirm ? "" : " disabled"}>Añadir vías seleccionadas →</button>
          </div>
        </div>`;

    } else {
      const allDone = coursesFromGroups(available).length === 0;
      selectorHtml = `<button class="av-add-group-btn" data-dr-open-picker type="button"${allDone ? " disabled" : ""}>+ Añadir grupo</button>`;
    }

    assignBlock.innerHTML = cardsHtml + selectorHtml;
  }

  // ── Group entry helpers ───────────────────────────────────────────────────

  function addGroupEntry(g, { skipRender = false } = {}) {
    if (drawerGroupEntries.some(e => e.groupId === g.id)) return;
    drawerGroupEntries.push({
      groupId:          g.id,
      groupName:        g.name || g.id,
      groupLetter:      groupLetter(g),
      groupMeta:        groupMeta(g),
      selectedSubjects: new Set(),
    });
    if (!skipRender) renderAssignBlock();
  }

  function removeGroupEntry(groupId) {
    drawerGroupEntries = drawerGroupEntries.filter(e => e.groupId !== groupId);
    renderAssignBlock();
  }

  function toggleSubject(groupId, subject) {
    const entry = drawerGroupEntries.find(e => e.groupId === groupId);
    if (!entry) return;
    if (entry.selectedSubjects.has(subject)) entry.selectedSubjects.delete(subject);
    else entry.selectedSubjects.add(subject);
    const card = assignBlock?.querySelector(`[data-dr-entry="${groupId}"] .av-assign-subjects`);
    if (card) {
      const chip = card.querySelector(`[data-dr-subject="${subject}"]`);
      if (chip) chip.classList.toggle("active", entry.selectedSubjects.has(subject));
      const meta = card.querySelector(".av-row-meta");
      if (meta) {
        const n = entry.selectedSubjects.size;
        meta.textContent = n === 0 ? "Ninguna seleccionada" : n === 1 ? "1 seleccionada" : `${n} seleccionadas`;
      }
    }
  }

  function buildAssignments() {
    const map = new Map();
    for (const entry of drawerGroupEntries) {
      for (const subject of entry.selectedSubjects) {
        const set = map.get(subject) || new Set();
        set.add(entry.groupId);
        map.set(subject, set);
      }
    }
    return [...map.entries()].map(([subject, groupIds]) => ({ subject, group_ids: [...groupIds] }));
  }

  // ── Open / close ──────────────────────────────────────────────────────────

  function open(teacher) {
    currentTeacher = teacher;

    // Header
    titleEl.textContent = teacher.display_name || teacher.email || "Docente";
    subEl.textContent   = teacher.email || "";

    // Fields
    nameInput.value  = teacher.display_name || "";
    emailInput.value = teacher.email || "";
    statusSel.value  = teacher.is_active === false ? "revoked" : "active";

    // Pre-load group entries from teacher's current assignments
    const groups = allGroups();
    drawerGroupEntries = (teacher.groups || []).map(tg => {
      const fullGroup = groups.find(g => g.id === tg.id) || tg;
      return {
        groupId:          tg.id,
        groupName:        tg.name || tg.id,
        groupLetter:      groupLetter(fullGroup),
        groupMeta:        groupMeta(fullGroup),
        selectedSubjects: new Set(tg.subjects || []),
      };
    });

    pickerStep     = 0;
    pickerCourse   = null;
    pickerTrackSet = new Set();

    renderAssignBlock();
    clearMsg();

    overlay.classList.add("open");
    nameInput.focus();
  }

  function close() {
    overlay.classList.remove("open");
    currentTeacher = null;
    drawerGroupEntries = [];
    pickerStep = 0;
    clearMsg();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!currentTeacher?.id) return;
    clearMsg();
    saveBtn.disabled = true;

    try {
      const body = {
        display_name: nameInput.value.trim(),
        email:        emailInput.value.trim().toLowerCase(),
        is_active:    statusSel.value === "active",
        assignments:  buildAssignments(),
      };

      if (!body.display_name) { showMsg("El nombre no puede estar vacío."); return; }
      if (!body.email || !body.email.includes("@")) { showMsg("Email inválido."); return; }

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

  // ── Event wiring ──────────────────────────────────────────────────────────

  // Close when clicking the backdrop (but not the panel)
  overlay.addEventListener("click", ev => {
    if (ev.target === overlay) close();
  });

  // Keyboard: Escape closes
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) close();
  });

  // Header close + footer buttons
  overlay.querySelector("#closeDrawerBtn")?.addEventListener("click", close);
  overlay.querySelector("#drawerCancelBtn")?.addEventListener("click", close);
  overlay.querySelector("#drawerSaveBtn")?.addEventListener("click", () => save().catch(console.error));
  overlay.querySelector("#drawerRevokeBtn")?.addEventListener("click", () => revoke().catch(console.error));

  // Assign block — event delegation (all picker interactions use data-dr-* attributes)
  assignBlock.addEventListener("click", ev => {
    // Subject chip toggle
    const subjectChip = ev.target.closest("[data-dr-subject]");
    if (subjectChip) {
      toggleSubject(subjectChip.dataset.drGroupId, subjectChip.dataset.drSubject);
      return;
    }
    // Remove group
    const removeBtn = ev.target.closest("[data-dr-remove]");
    if (removeBtn) { removeGroupEntry(removeBtn.dataset.drRemove); return; }
    // Open picker step 1
    if (ev.target.closest("[data-dr-open-picker]")) {
      pickerStep = 1; renderAssignBlock(); return;
    }
    // Step 1: pick course
    const courseChip = ev.target.closest("[data-dr-pick-course]");
    if (courseChip) {
      const [stage, yearStr] = courseChip.dataset.drPickCourse.split("|");
      pickerCourse   = { stage, year: Number(yearStr), label: `${STAGE_LABEL[stage] || stage} ${Number(yearStr)}º` };
      pickerTrackSet = new Set();
      pickerStep     = 2;
      renderAssignBlock();
      return;
    }
    // Step 2: toggle track
    const trackChip = ev.target.closest("[data-dr-pick-track]");
    if (trackChip) {
      const id = trackChip.dataset.drPickTrack;
      if (pickerTrackSet.has(id)) pickerTrackSet.delete(id);
      else pickerTrackSet.add(id);
      renderAssignBlock();
      return;
    }
    // Step 2: confirm tracks
    if (ev.target.closest("[data-dr-confirm-tracks]")) {
      const addedIds = new Set(drawerGroupEntries.map(e => e.groupId));
      const available = allGroups().filter(g => !addedIds.has(g.id));
      for (const id of pickerTrackSet) {
        const g = available.find(x => x.id === id);
        if (g) addGroupEntry(g, { skipRender: true });
      }
      pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set();
      renderAssignBlock();
      return;
    }
    // Back to step 1
    if (ev.target.closest("[data-dr-back-step1]")) {
      pickerStep = 1; pickerCourse = null; pickerTrackSet = new Set();
      renderAssignBlock();
      return;
    }
    // Cancel picker
    if (ev.target.closest("[data-dr-cancel-picker]")) {
      pickerStep = 0; pickerCourse = null; pickerTrackSet = new Set();
      renderAssignBlock();
      return;
    }
  });

  // ── Wire teacher list row clicks ──────────────────────────────────────────
  // Opens drawer when clicking a teacher row (not on a button)

  const teachersList = document.getElementById("teachersList");
  teachersList?.addEventListener("click", ev => {
    if (ev.target.closest("button")) return;
    const row = ev.target.closest("[data-teacher-key]");
    if (!row) return;
    const key = row.dataset.teacherKey;
    const teacher = (state.teachers || []).find(t => (t.id || t.email) === key);
    if (!teacher?.id) return; // Solo docentes con perfil registrado
    open(teacher);
  });

  // Make rows look clickable
  const styleTag = document.createElement("style");
  styleTag.textContent = `
    #teachersList [data-teacher-key] { cursor: default; }
    #teachersList .av-doc-row { cursor: pointer; transition: background 0.12s; }
    #teachersList .av-doc-row:hover { background: rgba(196,131,74,0.06); }
  `;
  document.head.appendChild(styleTag);

  return { open, close };
}
