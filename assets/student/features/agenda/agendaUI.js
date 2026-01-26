import { buildLabel, getItemsByType } from "./agendaMock.js";

function renderAgendaFromMock({ btnDeberes, btnExamen, btnTrabajo } = {}) {
  const entries = [
    { btn: btnDeberes, items: getItemsByType("deberes") },
    { btn: btnExamen, items: getItemsByType("examenes") },
    { btn: btnTrabajo, items: getItemsByType("trabajos") },
  ];

  entries.forEach(({ btn, items }) => {
    if (!btn) return;
    let list = btn.querySelector("ul.items");
    if (!list) {
      list = document.createElement("ul");
      list.className = "items";
      btn.appendChild(list);
    }
    list.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = buildLabel(item);
      list.appendChild(li);
    });
  });
}

export { renderAgendaFromMock };
