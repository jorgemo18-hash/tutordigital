import { createGroupSelector } from "./groupSelector.js";
import { createGroupImport } from "./groupImport.js";

// Punto de entrada "Importar lista" desde la pestaña Alumnos (nivel
// superior), junto a "+ Invitar alumno" — mismo patrón que ese botón
// (groupPicker.js): un selector de grupo (curso → vía, groupSelector.js) y,
// tras elegir grupo, el flujo de import existente (groupImport.js) montado
// sobre su propio juego de ids de DOM, sin duplicar nada de su lógica. El
// punto de entrada de dentro de Grupos → grupo sigue existiendo tal cual.

const IMPORT_IDS = {
  fileInputId: "alumnosImportFileInput",
  reviewWrapId: "alumnosImportReview",
  reviewTableId: "alumnosImportReviewTable",
  confirmBtnId: "alumnosImportConfirmBtn",
  resultId: "alumnosImportResult",
  errorId: "alumnosImportError",
};

export function createAlumnosImportEntry({ onImported }) {
  let selectedGroup = null;

  const groupImport = createGroupImport({
    ids: IMPORT_IDS,
    getGroup: () => selectedGroup,
  });

  const selector = createGroupSelector({
    containerId: "alumnosImportGroupPicker",
    onChange: (groupId, state) => {
      const groups = state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);
      selectedGroup = groupId ? groups.find((g) => g.id === groupId) || { id: groupId } : null;
      document.getElementById("alumnosImportForm")?.classList.toggle("hidden", !selectedGroup);
    },
  });

  function resetAll(state) {
    selectedGroup = null;
    selector.reset(state);
    groupImport.resetReview();
    document.getElementById("alumnosImportForm")?.classList.add("hidden");
  }

  function openPanel(state) {
    resetAll(state);
    document.getElementById("importStudentPanel")?.classList.remove("hidden");
    const showBtn = document.getElementById("showImportStudentBtn");
    if (showBtn) showBtn.textContent = "× Cancelar";
  }

  function closePanel(state) {
    document.getElementById("importStudentPanel")?.classList.add("hidden");
    const showBtn = document.getElementById("showImportStudentBtn");
    if (showBtn) showBtn.textContent = "Importar lista";
    resetAll(state);
  }

  function handleGroupPickerClick(ev, state) {
    return selector.handleClick(ev, state);
  }

  function handleFileChosen(state) {
    return groupImport.handleFileChosen(state);
  }

  function handleReviewClick(ev, state) {
    return groupImport.handleClick(ev, state, { onDone: onImported });
  }

  return { openPanel, closePanel, handleGroupPickerClick, handleFileChosen, handleReviewClick };
}
