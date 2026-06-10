export function renderGradeSection(type, { cardGrades, typePeriodTasks, studentId, showNotaMedia }) {
  const label = type === "exam" ? "Exámenes" : "Trabajos";
  const dotCls = type === "exam" ? "nbSectDot--examenes" : "nbSectDot--trabajos";
  const typeGrades = cardGrades.filter(g => g._taskType === type);

  const sect = document.createElement("section");
  sect.className = `nbSect nbSect--${type}`;

  const sectHead = document.createElement("header");
  sectHead.className = "nbSectHead";
  sectHead.innerHTML = `<span class="nbSectLeft"><span class="nbSectDot ${dotCls}"></span> ${label}</span>`;

  const rightEl = document.createElement("div");
  rightEl.className = "nbSectRight";

  if (typeGrades.length > 0) {
    const countSpan = document.createElement("span");
    countSpan.className = "nbSectCount";
    countSpan.textContent = `${typeGrades.length} nota${typeGrades.length !== 1 ? "s" : ""}`;
    rightEl.appendChild(countSpan);

    const verBtn = document.createElement("button");
    verBtn.className = "nbVerBtn";
    verBtn.textContent = "Ver";
    verBtn.dataset.nbAction = "open-task-grade";
    verBtn.dataset.studentId = studentId;
    verBtn.dataset.taskId = typeGrades[0].task_id;
    verBtn.dataset.taskIds = typePeriodTasks.map(t => t.id).join(",");
    rightEl.appendChild(verBtn);
  } else if (typePeriodTasks.length > 0) {
    const addBtn = document.createElement("button");
    addBtn.className = "nbAddNoteBtn";
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

  sectHead.appendChild(rightEl);
  sect.appendChild(sectHead);
  return sect;
}