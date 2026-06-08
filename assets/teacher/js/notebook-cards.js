import { apiFetch } from "../../shared/js/auth.js";
import { compareBySurname, normalizeStudent, formatStudentName } from "./state.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function countLocalDone(ctx, studentId, periodTasks) {
  const statuses = ctx.state.data.taskStatus?.[ctx.state.currentTeacherId] || {};
  return periodTasks.filter(t => statuses[t.id]?.[studentId] === "done").length;
}

export function fmtTime(secs) {
  if (!secs) return "—";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`.trim();
}

function badgeEl(estadoInfo) {
  if (estadoInfo.type === "needs_help") return null;
  const b = document.createElement("span");
  b.className = `nb-ticket-badge ${estadoInfo.type === "al_dia" ? "al-dia" : "pending"}`;
  b.textContent = estadoInfo.type === "al_dia" ? "Al día" : "Pendiente";
  return b;
}

// ── Nota media calculation ─────────────────────────────────────────────────

function calcNotaMedia(cardGrades, stats, weights) {
  const w = weights || { exam_pct: 60, work_pct: 20, homework_pct: 20 };

  const examScores = cardGrades
    .filter(g => g._taskType === "exam")
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);

  const workScores = cardGrades
    .filter(g => g._taskType === "work")
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);

  const hwScore = stats.total > 0 ? (stats.done / stats.total) * 10 : null;

  const parts = [];
  if (examScores.length > 0) {
    parts.push({ score: examScores.reduce((a, b) => a + b, 0) / examScores.length, weight: Number(w.exam_pct) });
  }
  if (workScores.length > 0) {
    parts.push({ score: workScores.reduce((a, b) => a + b, 0) / workScores.length, weight: Number(w.work_pct) });
  }
  if (hwScore !== null) {
    parts.push({ score: hwScore, weight: Number(w.homework_pct) });
  }

  if (!parts.length) return null;
  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  if (totalWeight === 0) return null;
  const value = parts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight;
  return value;
}

function formatNota(value) {
  if (value === null || value === undefined) return "—";
  return value % 1 === 0 ? String(value) : value.toFixed(1).replace(".", ",");
}

// ── Weight configurator popover (module-level singleton) ──────────────────

let _popover = null;
let _popoverAbort = null;

function getOrCreatePopover() {
  if (_popover) return _popover;
  const el = document.createElement("div");
  el.className = "nbWeightPopover";
  el.id = "nbWeightPopover";
  el.setAttribute("aria-modal", "false");
  el.innerHTML = `
    <div class="nbWeightHead">
      <span class="nbWeightTitle">Pesos de nota media</span>
      <button class="nbWeightClose" type="button" aria-label="Cerrar">✕</button>
    </div>
    <div class="nbWeightSubjectRow" id="nbWeightSubjectRow" style="display:none">
      <label class="nbWeightLbl">Asignatura</label>
      <select class="nbWeightSelect" id="nbWeightSubjectSel"></select>
    </div>
    <div class="nbWeightForm" id="nbWeightForm">
      <label class="nbWeightRow"><span class="nbWeightRowLbl">Exámenes</span>
        <span class="nbWeightInputWrap"><input class="nbWeightInput" id="nbWExam" type="number" min="0" max="100" step="1"><span class="nbWeightUnit">%</span></span>
      </label>
      <label class="nbWeightRow"><span class="nbWeightRowLbl">Trabajos</span>
        <span class="nbWeightInputWrap"><input class="nbWeightInput" id="nbWWork" type="number" min="0" max="100" step="1"><span class="nbWeightUnit">%</span></span>
      </label>
      <label class="nbWeightRow"><span class="nbWeightRowLbl">Tareas / deberes</span>
        <span class="nbWeightInputWrap"><input class="nbWeightInput" id="nbWHw" type="number" min="0" max="100" step="1"><span class="nbWeightUnit">%</span></span>
      </label>
      <p class="nbWeightTotal" id="nbWeightTotal">Total: 100%</p>
      <button class="nbWeightSave btn" id="nbWeightSave" type="button">Guardar</button>
      <p class="nbWeightErr" id="nbWeightErr" style="display:none"></p>
    </div>
  `;
  document.body.appendChild(el);
  _popover = el;
  return el;
}

function _closePopover() {
  if (_popover) _popover.classList.remove("open");
  if (_popoverAbort) { _popoverAbort.abort(); _popoverAbort = null; }
}

function openWeightPopover(anchorBtn, subjects, currentWeights, groupId) {
  const pop = getOrCreatePopover();

  // Position near anchor
  const rect = anchorBtn.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 280);
  pop.style.top  = `${rect.bottom + 6 + window.scrollY}px`;
  pop.style.left = `${Math.max(8, left)}px`;

  // Subject selector
  const subjectRow = pop.querySelector("#nbWeightSubjectRow");
  const subjectSel = pop.querySelector("#nbWeightSubjectSel");
  // subjects come from /api/v1/subjects → { id, name }
  if (subjects.length > 1) {
    subjectSel.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    subjectRow.style.display = "flex";
  } else {
    subjectRow.style.display = "none";
  }

  // Fill inputs for the first (or only) subject
  function fillInputs(subjectId) {
    const w = currentWeights.find(w => w.subject_id === subjectId) || { exam_pct: 60, work_pct: 20, homework_pct: 20 };
    pop.querySelector("#nbWExam").value = w.exam_pct;
    pop.querySelector("#nbWWork").value = w.work_pct;
    pop.querySelector("#nbWHw").value   = w.homework_pct;
    updateTotal();
  }

  function updateTotal() {
    const sum = [pop.querySelector("#nbWExam"), pop.querySelector("#nbWWork"), pop.querySelector("#nbWHw")]
      .reduce((a, inp) => a + (parseFloat(inp.value) || 0), 0);
    const totalEl = pop.querySelector("#nbWeightTotal");
    totalEl.textContent = `Total: ${Math.round(sum * 100) / 100}%`;
    totalEl.classList.toggle("nbWeightTotal--err", Math.round(sum) !== 100);
  }

  const firstSubjectId = subjects[0]?.id || null;
  fillInputs(firstSubjectId);

  pop.querySelector("#nbWeightSubjectSel")?.addEventListener("change", e => fillInputs(e.target.value));

  const errEl = pop.querySelector("#nbWeightErr");
  errEl.style.display = "none";

  // Open
  pop.classList.add("open");

  // Close button
  const ac = new AbortController();
  _popoverAbort = ac;

  pop.querySelector(".nbWeightClose").addEventListener("click", _closePopover, { signal: ac.signal });

  // Save
  pop.querySelector("#nbWeightSave").addEventListener("click", async () => {
    const subjectId = subjects.length > 1 ? subjectSel.value : firstSubjectId;
    if (!subjectId) return;
    const exam_pct     = parseFloat(pop.querySelector("#nbWExam").value) || 0;
    const work_pct     = parseFloat(pop.querySelector("#nbWWork").value) || 0;
    const homework_pct = parseFloat(pop.querySelector("#nbWHw").value)   || 0;
    if (Math.round((exam_pct + work_pct + homework_pct) * 100) !== 10000) {
      errEl.textContent = "Los porcentajes deben sumar exactamente 100.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";
    const saveBtn = pop.querySelector("#nbWeightSave");
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";
    try {
      const res = await apiFetch("/api/v1/grade-weights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId, trimester: _currentTrimester, exam_pct, work_pct, homework_pct }),
      });
      if (!res.ok) throw new Error("Error guardando pesos");
      _closePopover();
      window._tdRefreshNotebook?.();
    } catch {
      errEl.textContent = "Error al guardar. Inténtalo de nuevo.";
      errEl.style.display = "block";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
    }
  }, { signal: ac.signal });

  // Click outside to close
  setTimeout(() => {
    document.addEventListener("click", e => {
      if (!pop.contains(e.target) && e.target !== anchorBtn) _closePopover();
    }, { once: true, signal: ac.signal });
  }, 0);
}

// Module-level trimester tracker (set when renderPeriodStudentView is called)
let _currentTrimester = 1;

// ── Student card ───────────────────────────────────────────────────────────

export function buildStudentCard(student, {
  stats, sessionStats, progressTasks, cardGrades, estadoInfo, groupId,
  periodExamTasks = [], periodWorkTasks = [],
  subjects = [], gradeWeights = [], showNotaMedia = false,
}) {
  const studentId = String(student?.id || "").trim();
  const card = document.createElement("article");
  card.className = "nbStudentCard";
  card.dataset.studentId = studentId;

  const name = formatStudentName(student) || "Sin nombre";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  // Pick weights: use first subject's weights (or default if no subjects)
  const activeWeights = gradeWeights[0] || { exam_pct: 60, work_pct: 20, homework_pct: 20 };
  const notaMediaVal  = showNotaMedia ? calcNotaMedia(cardGrades, stats, activeWeights) : null;
  const notaStr       = formatNota(notaMediaVal);

  // ── Head: avatar + name/sub + nota media chip (or pct chip) ─────────────
  const head = document.createElement("header");
  head.className = "nbScHead";

  const avatarDiv = document.createElement("div");
  avatarDiv.className = "nbAvatar";
  avatarDiv.textContent = initials;

  const infoDiv = document.createElement("div");
  infoDiv.className = "nbScInfo";
  infoDiv.innerHTML = showNotaMedia
    ? `<div class="nbScName">${name}</div>`
    : `<div class="nbScName">${name}</div><div class="nbScSub">${stats.done} / ${stats.total} tareas · ${pct}%</div>`;

  if (showNotaMedia) {
    const notaChip = document.createElement("div");
    notaChip.className = "nbNotaChip";
    notaChip.innerHTML = `
      <span class="nbNotaVal">${notaStr}</span>
      <span class="nbNotaLbl">Nota media</span>
    `;
    if (subjects.length > 0) {
      const gearBtn = document.createElement("button");
      gearBtn.className = "nbWeightBtn";
      gearBtn.type = "button";
      gearBtn.title = "Configurar pesos";
      gearBtn.setAttribute("aria-label", "Configurar pesos de nota media");
      gearBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
      gearBtn.addEventListener("click", e => {
        e.stopPropagation();
        openWeightPopover(gearBtn, subjects, gradeWeights, groupId);
      });
      notaChip.appendChild(gearBtn);
    }
    head.appendChild(avatarDiv);
    head.appendChild(infoDiv);
    head.appendChild(notaChip);

    // Hint "⚙ Configurar pesos" — shown until first save for this subject+trimester
    if (subjects.length > 0 && !activeWeights.saved) {
      const hint = document.createElement("button");
      hint.className = "nbWeightHint";
      hint.type = "button";
      hint.textContent = "⚙ Configurar pesos";
      hint.addEventListener("click", e => {
        e.stopPropagation();
        const chipGear = head.querySelector(".nbWeightBtn");
        openWeightPopover(chipGear || hint, subjects, gradeWeights, groupId);
      });
      head.appendChild(hint);
    }
  } else {
    head.innerHTML = `
      <div class="nbAvatar">${initials}</div>
      <div class="nbScInfo">
        <div class="nbScName">${name}</div>
        <div class="nbScSub">${stats.done} / ${stats.total} tareas</div>
      </div>
      <div class="nbPctChip">
        <span class="nbPctNum">${pct}%</span>
        <span class="nbPctLbl">Tareas hechas</span>
      </div>
    `;
  }
  card.appendChild(head);

  // ── Stats grid ────────────────────────────────────────────────────────────
  const avgSecs = sessionStats.sessionDays > 0
    ? Math.round(sessionStats.totalSecs / sessionStats.sessionDays) : 0;
  const barPct = stats.total > 0
    ? Math.min(100, Math.round((sessionStats.solvedAlone / stats.total) * 100)) : 0;

  const statsGrid = document.createElement("div");
  if (showNotaMedia) {
    // 2×2 grid including "Tareas hechas"
    statsGrid.className = "nbStatsGrid";
    statsGrid.innerHTML = `
      <div class="nbStatCell">
        <span class="nbStatEye">Resolvió solo</span>
        <span class="nbStatVal">${sessionStats.solvedAlone}<em>/ ${stats.total}</em></span>
        <div class="nbStatBar"><div class="nbStatBarFill" style="width:${barPct}%"></div></div>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo tutor</span>
        <span class="nbStatVal">${fmtTime(sessionStats.totalSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo medio / tarea</span>
        <span class="nbStatVal">${fmtTime(avgSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tareas hechas</span>
        <span class="nbStatVal nbStatVal--sm">${stats.done}<em>/ ${stats.total}</em> · ${pct}%</span>
      </div>
    `;
  } else {
    statsGrid.className = "nbStatsGrid";
    statsGrid.innerHTML = `
      <div class="nbStatCell">
        <span class="nbStatEye">Resolvió solo</span>
        <span class="nbStatVal">${sessionStats.solvedAlone}<em>/ ${stats.total}</em></span>
        <div class="nbStatBar"><div class="nbStatBarFill" style="width:${barPct}%"></div></div>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo tutor</span>
        <span class="nbStatVal">${fmtTime(sessionStats.totalSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo medio / tarea</span>
        <span class="nbStatVal">${fmtTime(avgSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tareas completadas</span>
        <span class="nbStatVal nbStatVal--sm">${stats.done}<em>/ ${stats.total}</em></span>
      </div>
    `;
  }
  card.appendChild(statsGrid);

  // ── Progress expandable ───────────────────────────────────────────────────
  if (progressTasks.length > 0) {
    const expandRow = document.createElement("div");
    expandRow.className = "nbExpandRow";
    expandRow.dataset.nbAction = "toggle-progress";
    expandRow.dataset.studentId = studentId;
    expandRow.setAttribute("role", "button");
    expandRow.setAttribute("tabindex", "0");
    expandRow.innerHTML = `
      <span class="nbExpandTitle"><span class="nbExpandDot"></span> Progreso de tareas</span>
      <span class="nbExpandCount">Ver ${progressTasks.length} tareas <span class="nbNeedsHelpChevron">›</span></span>
    `;
    card.appendChild(expandRow);

    const progList = document.createElement("div");
    progList.className = "nbProgList";
    progList.id = `nbProgress_${studentId}`;
    progList.style.display = "none";

    progressTasks.forEach(pt => {
      const item = document.createElement("div");
      item.className = "nbProgItem";
      const statusCls = pt.status === "resolved" ? "resolved" : pt.status === "help" ? "help" : "pend";
      item.innerHTML = `
        <span class="nbProgStatus nbProgStatus--${statusCls}"></span>
        <span class="nbProgTitle">${pt.taskTitle}</span>
        <span class="nbProgDate">${pt.sessionDate || ""}</span>
      `;
      const btn = document.createElement("button");
      btn.className = "btn ghost nbBtn";
      btn.type = "button";
      btn.textContent = "Ver";
      btn.dataset.nbAction = "view-conversation";
      btn.dataset.studentId = studentId;
      btn.dataset.dayKey = pt.sessionDate;
      btn.dataset.taskTitle = pt.taskTitle;
      btn.dataset.taskId = pt.taskId;
      item.appendChild(btn);
      progList.appendChild(item);
    });
    card.appendChild(progList);
  }

  // ── Grades (exam + work) ──────────────────────────────────────────────────
  ["exam", "work"].forEach(type => {
    const label = type === "exam" ? "Exámenes" : "Trabajos";
    const dotCls = type === "exam" ? "nbSectDot--examenes" : "nbSectDot--trabajos";
    const typeGrades = cardGrades.filter(g => g._taskType === type);
    const typePeriodTasks = type === "exam" ? periodExamTasks : periodWorkTasks;

    const sect = document.createElement("section");
    sect.className = `nbSect nbSect--${type}`;

    if (showNotaMedia) {
      // Simplified: just count in header + Ver button
      const sectHead = document.createElement("header");
      sectHead.className = "nbSectHead";

      const countEl = document.createElement("span");
      countEl.className = "nbSectLeft";
      countEl.innerHTML = `<span class="nbSectDot ${dotCls}"></span> ${label}`;

      const rightEl = document.createElement("div");
      rightEl.className = "nbSectRight";

      if (typeGrades.length > 0) {
        const countSpan = document.createElement("span");
        countSpan.className = "nbSectCount";
        countSpan.textContent = `${typeGrades.length} nota${typeGrades.length !== 1 ? "s" : ""}`;
        rightEl.appendChild(countSpan);

        const verBtn = document.createElement("button");
        verBtn.className = "nbVerBtn";
        verBtn.type = "button";
        verBtn.textContent = "Ver";
        verBtn.dataset.nbAction = "open-task-grade";
        verBtn.dataset.studentId = studentId;
        verBtn.dataset.taskType = type;
        verBtn.dataset.skipTaskCards = "true";
        // Pass all period task IDs so the drawer can load all grades from state
        verBtn.dataset.taskId  = typePeriodTasks[0]?.id || typeGrades[0]?.task_id || "";
        verBtn.dataset.taskIds = typePeriodTasks.map(t => t.id).join(",");
        rightEl.appendChild(verBtn);
      } else if (typePeriodTasks.length > 0) {
        const addBtn = document.createElement("button");
        addBtn.className = "nbAddNoteBtn";
        addBtn.type = "button";
        addBtn.textContent = "+";
        addBtn.dataset.nbAction = "open-task-grade";
        addBtn.dataset.taskId = typePeriodTasks[0].id;
        addBtn.dataset.taskIds = typePeriodTasks.map(t => t.id).join(",");
        addBtn.dataset.studentId = studentId;
        rightEl.appendChild(addBtn);
      } else {
        const emptySpan = document.createElement("span");
        emptySpan.className = "nbSectEmpty";
        emptySpan.textContent = "Sin notas";
        rightEl.appendChild(emptySpan);
      }

      sectHead.appendChild(countEl);
      sectHead.appendChild(rightEl);
      sect.appendChild(sectHead);
    } else {
      // Original design with nota media inside section body
      const sectHead = document.createElement("header");
      sectHead.className = "nbSectHead";
      sectHead.innerHTML = `
        <span class="nbSectLeft"><span class="nbSectDot ${dotCls}"></span> ${label}</span>
        <span>${typeGrades.length}</span>
      `;
      sect.appendChild(sectHead);

      if (!typeGrades.length) {
        if (typePeriodTasks.length > 0) {
          const addBtn = document.createElement("button");
          addBtn.className = "nbAddNoteBtn";
          addBtn.type = "button";
          addBtn.textContent = "+";
          addBtn.dataset.nbAction = "open-task-grade";
          addBtn.dataset.taskId = typePeriodTasks[0].id;
          addBtn.dataset.taskIds = typePeriodTasks.map(t => t.id).join(",");
          addBtn.dataset.studentId = studentId;
          sect.appendChild(addBtn);
        } else {
          const empty = document.createElement("div");
          empty.className = "nbSectEmpty";
          empty.textContent = "Sin notas en el periodo";
          sect.appendChild(empty);
        }
      } else {
        const numericScores = typeGrades
          .map(g => parseFloat(String(g.score || "").replace(",", ".")))
          .filter(n => Number.isFinite(n) && n >= 0);

        const body = document.createElement("div");
        body.className = "nbSectBody";

        if (typeGrades.length === 1) {
          const scoreLabel = document.createElement("span");
          scoreLabel.className = "nbNoteAvgLabel";
          scoreLabel.textContent = typeGrades[0].score;

          const editBtn = document.createElement("button");
          editBtn.className = "nbVerBtn";
          editBtn.type = "button";
          editBtn.textContent = "Editar";
          editBtn.dataset.nbAction = "open-task-grade";
          editBtn.dataset.taskId = typeGrades[0].task_id || (typePeriodTasks[0]?.id || "");
          editBtn.dataset.taskIds = typePeriodTasks.map(t => t.id).join(",");
          editBtn.dataset.studentId = studentId;

          body.appendChild(scoreLabel);
          body.appendChild(editBtn);
        } else {
          const avgLabel = document.createElement("span");
          avgLabel.className = "nbNoteAvgLabel";
          if (numericScores.length > 0) {
            const avg = numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
            const avgText = avg % 1 === 0 ? String(avg) : avg.toFixed(1).replace(".", ",");
            avgLabel.textContent = `Nota media: ${avgText}`;
          } else {
            avgLabel.textContent = `${typeGrades.length} nota${typeGrades.length !== 1 ? "s" : ""}`;
          }

          const verBtn = document.createElement("button");
          verBtn.className = "nbVerBtn";
          verBtn.type = "button";
          verBtn.textContent = "Ver";
          verBtn.dataset.nbAction = "view-period-grades";
          verBtn.dataset.studentId = studentId;
          verBtn.dataset.taskType = type;

          body.appendChild(avgLabel);
          body.appendChild(verBtn);
        }
        sect.appendChild(body);
      }
    }

    card.appendChild(sect);
  });

  // ── AI report block ────────────────────────────────────────────────────────
  const reportArea = document.createElement("div");
  reportArea.id = `nbReport_${studentId}`;
  reportArea.className = "nbAiBlock";
  reportArea.innerHTML = `
    <div class="nbAiContent">
      <div>
        <div class="nbAiTitle">Resumen narrativo</div>
        <div class="nbAiSub">La IA escribe un informe a partir de estos datos</div>
      </div>
      <button class="nbAiBtn" type="button"
        data-nb-action="generate-report"
        data-student-id="${studentId}"
        data-group-id="${groupId}">✦ Generar informe IA</button>
    </div>
  `;
  card.appendChild(reportArea);

  return card;
}

// ── Class aggregated card ──────────────────────────────────────────────────

export function buildClassCard({ students, allStats, allSessions, periodGrades, periodTasks, groupName }) {
  let totalAssigned = 0;
  let totalDone = 0;
  let totalSecs = 0;
  const needsCount = new Map();

  students.forEach(s => {
    const stats = allStats.get(s.id) || { total: 0, done: 0 };
    totalAssigned += stats.total;
    totalDone += stats.done;

    const sessions = allSessions.get(s.id) || [];
    totalSecs += sessions.reduce((acc, sess) => acc + (sess.duration_seconds || 0), 0);

    const helpCount = sessions.filter(sess => sess.needs_help).length;
    if (helpCount > 0) needsCount.set(s.id, helpCount);
  });

  const avgSecs = students.length > 0 ? Math.round(totalSecs / students.length) : 0;
  const pct = totalAssigned > 0 ? Math.round((totalDone / totalAssigned) * 100) : 0;

  const top3 = [...needsCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => {
      const s = students.find(st => st.id === id);
      return { name: s ? formatStudentName(s) : id, count };
    });

  const examGrades = periodGrades.filter(g => {
    const task = periodTasks.find(t => t.id === g.task_id);
    return task?.type === "exam";
  });
  const numericScores = examGrades
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);
  const gradeAvg = numericScores.length > 0
    ? (numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1)
    : null;

  const card = document.createElement("div");
  card.className = "nbClassCard";

  card.innerHTML = `
    <div class="nbClassCardHead">
      <span class="nbStudentName">${groupName || "Clase"}</span>
      <span class="nb-ticket-badge al-dia">${students.length} alumnos</span>
    </div>
    <div class="nbStudentCardStats nbStudentCardStats--class">
      <div class="nbStatItem">
        <span class="nbStatLabel">Tareas completadas</span>
        <span class="nbStatValue">${totalDone}/${totalAssigned} (${pct}%)</span>
      </div>
      <div class="nbStatItem">
        <span class="nbStatLabel">Tiempo medio/alumno</span>
        <span class="nbStatValue">${fmtTime(avgSecs)}</span>
      </div>
      ${gradeAvg ? `
      <div class="nbStatItem">
        <span class="nbStatLabel">Media exámenes</span>
        <span class="nbStatValue">${gradeAvg}</span>
      </div>` : ""}
    </div>
    ${top3.length ? `
    <div class="nbGradeBlock">
      <span class="nbGradeBlockLabel">Más necesitaron ayuda</span>
      <div class="nbHelpRanking">
        ${top3.map((item, i) => `
          <div class="nbHelpRankItem">
            <span class="nbHelpRankPos">${i + 1}</span>
            <span class="nbHelpRankName">${item.name}</span>
            <span class="nbGradeTag">${item.count} sesiones</span>
          </div>`).join("")}
      </div>
    </div>` : ""}
  `;
  return card;
}

// ── Period rendering (student or class view) ───────────────────────────────

export function renderPeriodStudentView(ctx, {
  students, summaryById, summaryByName, periodTasks,
  taskTypeMap, taskTitleMap, sessions, periodGrades, allTickets, groupId,
  subjects = [], gradeWeights = [], notebookMode = "week",
}) {
  const asCount = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
  const nameKey = s => String(formatStudentName(normalizeStudent(s)) || "").trim().toLowerCase();
  const periodExamTasks = periodTasks.filter(t => t.type === "exam");
  const periodWorkTasks = periodTasks.filter(t => t.type === "work");

  // Determine trimester number from state
  _currentTrimester = { t1: 1, t2: 2, t3: 3 }[ctx.state.notebookTerm] || 1;
  const showNotaMedia = notebookMode === "term" && subjects.length > 0;

  const sessionsByStudent = new Map();
  sessions.forEach(s => {
    if (!sessionsByStudent.has(s.student_id)) sessionsByStudent.set(s.student_id, []);
    sessionsByStudent.get(s.student_id).push(s);
  });

  const gradesByStudent = new Map();
  periodGrades.forEach(g => {
    if (!gradesByStudent.has(g.student_id)) gradesByStudent.set(g.student_id, []);
    gradesByStudent.get(g.student_id).push({
      ...g,
      _taskType: taskTypeMap.get(g.task_id) || "other",
      _taskTitle: taskTitleMap.get(g.task_id) || "",
    });
  });

  students.forEach(student => {
    const summaryMatch = summaryById.get(String(student.id || "").trim()) || summaryByName.get(nameKey(student));
    let stats = {
      total: asCount(summaryMatch?.tasks_total) || periodTasks.length,
      done: asCount(summaryMatch?.tasks_done) || countLocalDone(ctx, student.id, periodTasks),
      needs: asCount(summaryMatch?.tickets_open),
    };

    const stuSessions = sessionsByStudent.get(student.id) || [];
    const latestByTask = new Map();
    stuSessions.forEach(s => {
      const prev = latestByTask.get(s.task_id);
      if (!prev || s.created_at > prev.created_at) latestByTask.set(s.task_id, s);
    });

    const progressTasks = periodTasks.map(task => {
      const latestSession = latestByTask.get(task.id);
      const status = !latestSession ? "pending" : latestSession.needs_help ? "help" : "resolved";
      return {
        taskId: task.id,
        taskTitle: taskTitleMap.get(task.id) || task.title || "Tarea",
        sessionDate: latestSession?.session_date || "",
        status,
      };
    });

    const sessionDays = new Set(stuSessions.map(s => s.session_date)).size;
    const periodTaskIds = new Set(periodTasks.map(t => t.id));
    const sessionStats = {
      totalSecs: stuSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
      solvedAlone: [...latestByTask.entries()]
        .filter(([taskId, s]) => periodTaskIds.has(taskId) && !s.needs_help).length,
      neededHelp: progressTasks.filter(t => t.status === "help").length,
      sessionDays,
    };

    const openTickets = allTickets
      .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    let estadoInfo;
    if (stats.needs > 0 || openTickets.length > 0) estadoInfo = { type: "needs_help", ticketId: openTickets[0]?.id || "" };
    else if (summaryMatch?.status === "submitted" || (stats.total > 0 && stats.done >= stats.total)) estadoInfo = { type: "al_dia" };
    else estadoInfo = { type: "pending" };

    const card = buildStudentCard(student, {
      stats, sessionStats, progressTasks,
      cardGrades: gradesByStudent.get(student.id) || [],
      estadoInfo, groupId,
      periodExamTasks,
      periodWorkTasks,
      subjects,
      gradeWeights,
      showNotaMedia,
    });
    ctx.elements.notebookGrid.appendChild(card);
  });
}

export function renderPeriodClassView(ctx, {
  students, summaryById, summaryByName, sessions, periodGrades, periodTasks, groupId
}) {
  const asCount = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
  const nameKey = s => String(formatStudentName(normalizeStudent(s)) || "").trim().toLowerCase();

  const allStats = new Map();
  const allSessions = new Map();

  students.forEach(student => {
    const summaryMatch = summaryById.get(String(student.id || "").trim()) || summaryByName.get(nameKey(student));
    allStats.set(student.id, {
      total: asCount(summaryMatch?.tasks_total) || periodTasks.length,
      done: asCount(summaryMatch?.tasks_done) || countLocalDone(ctx, student.id, periodTasks),
    });
  });

  sessions.forEach(s => {
    if (!allSessions.has(s.student_id)) allSessions.set(s.student_id, []);
    allSessions.get(s.student_id).push(s);
  });

  const group = ctx.state.data.groups?.find(g => g.id === groupId);
  const groupName = group?.name || "Clase";

  const card = buildClassCard({ students, allStats, allSessions, periodGrades, periodTasks, groupName });
  ctx.elements.notebookGrid.appendChild(card);
}

export { compareBySurname, normalizeStudent };
