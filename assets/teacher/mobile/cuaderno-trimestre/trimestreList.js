// trimestreList.js — Level 1 of the mobile Trimestre view: one compact row
// per student (avatar, name, nota media). Tapping a row opens Level 2.

import { formatNota } from "./trimestreCalc.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function _initials(name) {
  const p = String(name || "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0]?.[0] || "?").toUpperCase();
}

function _renderRow(student, data, onSelectStudent) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "mt-trow";

  row.innerHTML = `
    <div class="mt-avatar">${_esc(_initials(student.name))}</div>
    <div class="mt-trow-info">
      <div class="mt-trow-name">${_esc(student.name)}</div>
    </div>
    <div class="mt-trow-nota">
      <span class="mt-trow-nota-val">${_esc(formatNota(data.notaMediaVal))}</span>
      <span class="mt-trow-nota-lbl">Nota media</span>
    </div>`;

  row.addEventListener("click", () => onSelectStudent(student.id));
  return row;
}

export function renderTrimestreList({ containerEl, students, dataByStudent, onSelectStudent }) {
  containerEl.innerHTML = "";
  if (!students.length) {
    containerEl.innerHTML = `<div class="mt-loading">No hay alumnos en este grupo.</div>`;
    return;
  }
  students.forEach(student => {
    const data = dataByStudent.get(student.id);
    if (!data) return;
    containerEl.appendChild(_renderRow(student, data, onSelectStudent));
  });
}
