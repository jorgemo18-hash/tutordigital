import { slugifySubject } from "./agendaUtils.js";
import { escHtml } from "../../../shared/js/escHtml.js";

export function renderCard(task, kind, { taskStatusMap }) {
  const li = document.createElement("li");
  const status = taskStatusMap.get(task.id);
  const isDone = status === "done";
  const isNeedsHelp = status === "needs_teacher";
  li.className = "td-card" + (kind === "atrasada" ? " urgent" : "") + (isDone ? " done" : "") + (isNeedsHelp ? " needs-help" : "");
  li.dataset.cardTaskId = task.id;
  const due = task.dueDate
    ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    : null;
  const subjectLabel = task.subjectName || task.subject || "";
  const subjectSlug = subjectLabel ? slugifySubject(subjectLabel) : "";
  const clockIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  li.innerHTML = `
    <div class="td-card-tag-row">
      ${subjectLabel ? `<span class="td-tag ${subjectSlug}">${escHtml(subjectLabel)}</span>` : ""}
      ${kind === "atrasada" ? '<span class="td-badge-atrasada">Atrasada</span>' : ""}
      ${kind === "examen" ? '<span class="td-badge-tipo">Examen</span>' : ""}
      ${kind === "trabajo" ? '<span class="td-badge-tipo">Trabajo</span>' : ""}
    </div>
    <div class="td-card-title">
      <span class="agendaTaskLink" data-task-id="${task.id}" role="button" tabindex="0">${escHtml(task.title)}</span>
      ${task.attachments?.length ? `<span class="agendaAttachIndicator">📎 ${task.attachments.length}</span>` : ""}
    </div>
    <div class="td-card-foot">
      ${due ? `<span>${clockIcon} ${due}</span>` : "<span></span>"}
      ${task.estimatedMinutes ? `<span>${task.estimatedMinutes} min</span>` : ""}
    </div>
  `;
  return li;
}

export function getOrCreateList(btn) {
  if (btn.tagName === "UL") return btn;
  let list = btn.querySelector("ul.items");
  if (!list) { list = document.createElement("ul"); list.className = "items"; btn.appendChild(list); }
  return list;
}

export function renderLoadingState(containers) {
  containers.forEach((btn) => {
    if (!btn) return;
    getOrCreateList(btn).innerHTML = '<li class="agendaLoading">Cargando…</li>';
  });
}

export function renderEmptyState(list, message = "Nada por aquí de momento") {
  const li = document.createElement("li");
  li.className = "agendaEmpty";
  li.textContent = message;
  list.appendChild(li);
}

export function renderAtrasadas(container, tasks, { taskStatusMap }) {
  container.querySelectorAll(".atrasadas-section").forEach((el) => el.remove());
  const origList = container.querySelector("ul.items");
  if (origList) origList.innerHTML = "";

  const sorted = tasks.slice().sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const deberes = sorted.filter((t) => t.type === "homework");
  const trabajos = sorted.filter((t) => t.type === "work");

  if (!deberes.length && !trabajos.length) {
    if (origList) renderEmptyState(origList);
    return;
  }

  const hint = container.querySelector(".td-col-hint");

  function insertSection(label, items) {
    const lbl = document.createElement("p");
    lbl.className = "td-col-subsection-label atrasadas-section";
    lbl.textContent = label;
    container.insertBefore(lbl, hint || null);
    const ul = document.createElement("ul");
    ul.className = "items atrasadas-section";
    items.forEach((t) => ul.appendChild(renderCard(t, "atrasada", { taskStatusMap })));
    container.insertBefore(ul, hint || null);
  }

  if (deberes.length) insertSection("DEBERES", deberes);
  if (deberes.length && trabajos.length) {
    const sep = document.createElement("div");
    sep.className = "td-col-separator atrasadas-section";
    container.insertBefore(sep, hint || null);
  }
  if (trabajos.length) insertSection("TRABAJOS", trabajos);
}

export function initAgendaTaskHandlers(onCardClick) {
  const agenda = document.getElementById("agenda");
  if (!agenda) return;
  agenda.addEventListener("click", (event) => {
    const target = event.target.closest("[data-card-task-id]");
    if (!target) return;
    event.preventDefault();
    onCardClick(target.dataset.cardTaskId);
  });
  agenda.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest("[data-card-task-id]") || event.target.closest("[data-task-id]");
    if (!target) return;
    event.preventDefault();
    onCardClick(target.dataset.cardTaskId || target.dataset.taskId);
  });
}