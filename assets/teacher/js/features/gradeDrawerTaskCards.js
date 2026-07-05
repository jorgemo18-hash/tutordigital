// gradeDrawerTaskCards.js — Renders the task-card tabs in grade-drawer.js,
// shown only when scoring multiple tasks of the same type outside
// skipTaskCards mode. Split out to keep grade-drawer.js under budget.
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

export function renderTaskCards({ taskSection, taskCards, allTasks, activeTaskId, skipTaskCards }) {
  if (skipTaskCards || allTasks.length <= 1) {
    taskSection.style.display = "none";
    return;
  }
  taskSection.style.display = "";
  taskCards.innerHTML = "";
  allTasks.forEach(task => {
    const btn = document.createElement("button");
    btn.className = "gd-task-card" + (task.id === activeTaskId ? " gd-task-card--active" : "");
    btn.type = "button";
    btn.dataset.gdTaskId = task.id;
    btn.innerHTML = `
      <span class="gd-task-name">${_esc(task.title)}</span>
      <span class="gd-task-date">${_esc(task.dueDate || "")}</span>
    `;
    taskCards.appendChild(btn);
  });
}
