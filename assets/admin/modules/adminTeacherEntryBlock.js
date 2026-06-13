import { escHtml } from "./adminUtils.js";

// ── Constants ──────────────────────────────────────────────────────────────

export const STAGE_KEYS  = ["primaria", "eso", "bachiller", "otros"];
export const STAGE_LABEL = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato", otros: "Otros" };

// ── Group helpers ──────────────────────────────────────────────────────────

export function groupLetter(g) {
  const level = String(g.level || g.stage || "").toLowerCase();
  if (level.includes("bach")) return "B";
  if (level.includes("eso") || level.includes("secund")) return "E";
  if (level.includes("prima")) return "P";
  return (g.name || "?")[0].toUpperCase();
}

export function groupMeta(g) {
  const parts = [g.level, g.course].filter(Boolean);
  if (g.students != null) parts.push(`${g.students} alumnos`);
  return parts.join(" · ");
}

export function inferStageFromGroup(g) {
  const raw = String(g.level || g.stage || g.name || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (raw.includes("prim")) return "primaria";
  if (raw.includes("eso") || raw.includes("secund")) return "eso";
  if (raw.includes("bach")) return "bachiller";
  return "otros";
}

export function inferYearFromGroup(g) {
  const fromField = Number(g.year || 0);
  if (Number.isInteger(fromField) && fromField >= 1 && fromField <= 6) return fromField;
  const m = String(g.course || g.name || "").match(/\b([1-6])[ºo°]?/);
  return m ? Number(m[1]) : 0;
}

export function extractTrack(g) {
  if (g.track) return String(g.track).toUpperCase().trim();
  const norm = String(g.normalized_name || "");
  if (norm.includes("|")) {
    const last = norm.split("|").at(-1).toUpperCase().trim();
    if (last) return last;
  }
  return String(g.name || "").trim().split(/\s+/).at(-1).toUpperCase();
}

export function coursesFromGroups(groups) {
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

export function groupsForCourse(groups, stage, year) {
  return groups.filter(g => inferStageFromGroup(g) === stage && inferYearFromGroup(g) === year);
}

// ── Summary text for collapsed view ────────────────────────────────────────

function entrySummaryText(entry) {
  const subs = [...entry.selectedSubjects];
  if (!subs.length) return "Sin asignaturas";
  if (subs.length <= 2) return subs.join(" · ");
  return `${subs.length} asignaturas`;
}

// ── Assign block renderer ──────────────────────────────────────────────────
//
// Renders group entries + group picker into `container.innerHTML`.
// Uses data-ab-* attributes for event delegation by the caller.
//
// entries: [{groupId, groupName, groupLetter, groupMeta, selectedSubjects: Set, isTutor: bool}]
// availableGroups: groups NOT yet in entries
// subjects: subject catalog array
// expandedGroupId: which entry is currently expanded (null = all collapsed)
// pickerStep: 0=off, 1=course, 2=track
// pickerCourse: {stage, year, label} | null
// pickerTrackSet: Set<groupId>
// showIsTutor: if true, renders per-entry is_tutor toggle in expanded view
// showTutorSection: if true, renders bottom tutor-chip section (create form)
// tutorGroupId: currently selected single tutor group (for create form)

export function renderAssignBlock(container, {
  entries, availableGroups, subjects,
  expandedGroupId  = null,
  pickerStep       = 0,
  pickerCourse     = null,
  pickerTrackSet   = new Set(),
  showIsTutor      = false,
  showTutorSection = false,
  tutorGroupId     = null,
}) {
  const cardsHtml = entries.map(entry => {
    const isExpanded = expandedGroupId === entry.groupId;

    if (!isExpanded) {
      const tutorBadge = entry.isTutor
        ? ` <span class="av-tutor-badge">Tutor</span>` : "";
      return `
        <div class="av-assign-entry av-assign-entry--collapsed" data-ab-expand="${escHtml(entry.groupId)}">
          <div class="av-assign-summary">
            <div class="av-letter">${escHtml(entry.groupLetter)}</div>
            <div class="av-assign-summary-text">
              <div class="av-assign-name">${escHtml(entry.groupName)}${tutorBadge}</div>
              <div class="av-assign-sub">${escHtml(entrySummaryText(entry))}</div>
            </div>
            <button class="av-icon-btn danger" data-ab-remove="${escHtml(entry.groupId)}" type="button" title="Quitar grupo">×</button>
          </div>
        </div>`;
    }

    const count      = entry.selectedSubjects.size;
    const countLabel = count === 0 ? "Ninguna seleccionada"
      : count === 1 ? "1 seleccionada"
      : `${count} seleccionadas`;
    const chipsHtml = subjects.map(s => {
      const active = entry.selectedSubjects.has(s) ? " active" : "";
      return `<span class="av-subject-chip${active}" data-ab-subject="${escHtml(s)}" data-ab-group="${escHtml(entry.groupId)}">${escHtml(s)}</span>`;
    }).join("");
    const tutorToggleHtml = showIsTutor
      ? `<label class="av-tutor-toggle"><input type="checkbox" data-ab-is-tutor="${escHtml(entry.groupId)}"${entry.isTutor ? " checked" : ""}> Es tutor de este grupo</label>`
      : "";

    return `
      <div class="av-assign-entry av-assign-entry--expanded">
        <div class="av-assign-item av-assign-item--clickable" data-ab-expand="${escHtml(entry.groupId)}">
          <div class="av-letter">${escHtml(entry.groupLetter)}</div>
          <div>
            <div class="av-assign-name">${escHtml(entry.groupName)}</div>
            ${entry.groupMeta ? `<div class="av-assign-sub">${escHtml(entry.groupMeta)}</div>` : ""}
          </div>
          <button class="av-icon-btn danger" data-ab-remove="${escHtml(entry.groupId)}" type="button" title="Quitar grupo">×</button>
        </div>
        <div class="av-assign-subjects">
          <div class="av-assign-subjects-head">
            <span class="av-label">Asignaturas que impartirá</span>
            <span class="av-row-meta" data-ab-subject-count="${escHtml(entry.groupId)}">${escHtml(countLabel)}</span>
          </div>
          <div class="av-subject-pick">${chipsHtml}</div>
          ${tutorToggleHtml}
        </div>
      </div>`;
  }).join("");

  const tutorSectionHtml = showTutorSection && entries.length ? `
    <div class="av-tutor-section">
      <span class="av-label">Tutoría <span class="av-label-opt">(opcional)</span></span>
      <div class="av-subject-pick">
        ${entries.map(e => {
          const active = tutorGroupId === e.groupId ? " active" : "";
          return `<span class="av-subject-chip${active}" data-ab-tutor-chip="${escHtml(e.groupId)}">${escHtml(e.groupName)}</span>`;
        }).join("")}
      </div>
    </div>` : "";

  let selectorHtml = "";

  if (pickerStep === 1) {
    const courses = coursesFromGroups(availableGroups);
    if (!courses.length) {
      selectorHtml = `
        <div class="av-group-picker">
          <div class="av-group-picker-head">
            <span class="av-label">Añadir grupo</span>
            <button class="av-icon-btn" data-ab-cancel-picker type="button" title="Cerrar">×</button>
          </div>
          <p class="av-no-assign">Todos los grupos han sido añadidos.</p>
        </div>`;
    } else {
      const byStage = {};
      for (const c of courses) (byStage[c.stage] = byStage[c.stage] || []).push(c);
      const stagesHtml = STAGE_KEYS.filter(s => byStage[s]).map(s => {
        const chips = byStage[s].map(c =>
          `<span class="av-subject-chip" data-ab-pick-course="${escHtml(c.key)}">${escHtml(c.label)}</span>`
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
            <button class="av-icon-btn" data-ab-cancel-picker type="button" title="Cerrar">×</button>
          </div>
          ${stagesHtml}
        </div>`;
    }

  } else if (pickerStep === 2 && pickerCourse) {
    const courseGroups = groupsForCourse(availableGroups, pickerCourse.stage, pickerCourse.year);
    const trackChips   = courseGroups.map(g => {
      const track  = extractTrack(g);
      const active = pickerTrackSet.has(g.id) ? " active" : "";
      return `<span class="av-subject-chip${active}" data-ab-pick-track="${escHtml(g.id)}" title="${escHtml(g.name)}">${escHtml(track)}</span>`;
    }).join("");
    const canConfirm = pickerTrackSet.size > 0;
    selectorHtml = `
      <div class="av-group-picker">
        <div class="av-group-picker-head">
          <span class="av-label">${escHtml(pickerCourse.label)} — elige vías</span>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn ghost small" data-ab-back-step1 type="button">← Curso</button>
            <button class="av-icon-btn" data-ab-cancel-picker type="button" title="Cerrar">×</button>
          </div>
        </div>
        <div class="av-subject-pick">${trackChips}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:4px">
          <button class="btn primary small" data-ab-confirm-tracks type="button"${canConfirm ? "" : " disabled"}>Añadir vías seleccionadas →</button>
        </div>
      </div>`;

  } else {
    const allDone = coursesFromGroups(availableGroups).length === 0;
    selectorHtml = `<button class="av-add-group-btn" data-ab-open-picker type="button"${allDone ? " disabled" : ""}>+ Añadir grupo</button>`;
  }

  container.innerHTML = cardsHtml + tutorSectionHtml + selectorHtml;
}

// ── Payload builder (for PATCH /admin/teachers/:id) ─────────────────────────
// Returns all group IDs and tutor IDs separately from subject assignments,
// so the backend can persist groups even when no subjects are selected.

export function buildPayload(entries) {
  const subjectMap = new Map();
  for (const entry of entries) {
    for (const subject of entry.selectedSubjects) {
      const groupSet = subjectMap.get(subject) || new Set();
      groupSet.add(entry.groupId);
      subjectMap.set(subject, groupSet);
    }
  }
  return {
    assignments:     [...subjectMap.entries()].map(([subject, groupIds]) => ({
      subject,
      group_ids: [...groupIds],
    })),
    group_ids:       entries.map(e => e.groupId),
    tutor_group_ids: entries.filter(e => e.isTutor).map(e => e.groupId),
  };
}
