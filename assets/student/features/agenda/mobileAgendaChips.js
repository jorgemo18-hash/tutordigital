// Chips de navegación móvil de la agenda (Semana/Exámenes-Trabajos/
// Atrasadas) — 100% autocontenido, sin dependencias del resto de student.js,
// por eso no recibe ningún parámetro.
export function initMobileAgendaChips() {
  const chipSemana    = document.getElementById("chipSemana");
  const chipExamenes  = document.getElementById("chipExamenes");
  const chipAtrasadas = document.getElementById("chipAtrasadas");

  const sectionMap = {
    semana:    document.querySelector(".col-semana"),
    examenes:  document.querySelector(".col-examenes-trabajos"),
    atrasadas: document.querySelector(".col-atrasadas"),
  };

  function activateChip(key, chipEl) {
    [chipSemana, chipExamenes, chipAtrasadas].forEach(c => c?.classList.remove("is-active"));
    chipEl?.classList.add("is-active");
    requestAnimationFrame(() => sectionMap[key]?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" }));
  }

  chipSemana?.addEventListener("click",    () => activateChip("semana",    chipSemana));
  chipExamenes?.addEventListener("click",  () => activateChip("examenes",  chipExamenes));
  chipAtrasadas?.addEventListener("click", () => activateChip("atrasadas", chipAtrasadas));

  // Mirror overdue count onto the chip
  const countEl = document.getElementById("countAtrasadas");
  if (countEl) {
    const syncCount = () => {
      const n = parseInt(countEl.textContent, 10) || 0;
      if (!chipAtrasadas) return;
      chipAtrasadas.innerHTML = n > 0
        ? `Atrasadas · <span class="chip-count">${n}</span>`
        : "Atrasadas";
    };
    syncCount();
    new MutationObserver(syncCount).observe(countEl, { childList: true, characterData: true, subtree: true });
  }
}
