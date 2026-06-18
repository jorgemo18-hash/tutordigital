// masMenuController.js — Orchestrates the "Más" tab: menu sheet →
// "Configurar pesos" sub-view, back navigates to the menu (not the
// previous tab) — same pushBackGuard/popBackGuard pattern as
// cuaderno-trimestre/trimestreController.js.

import { openSheet, closeSheet } from "../mobileTeacherSheets.js";
import { pushBackGuard, popBackGuard } from "../../../shared/js/mobileBackGuard.js";
import { renderMasMenu } from "./masMenuSheet.js";
import { renderMobileWeightsSheet } from "./mobileWeightsSheet.js";

export function openMasMenu({ sheetEl, backdropEl, apiFetch, groupId, onSwitchToPerfil }) {
  const contentEl = sheetEl.querySelector("#mtSheetContent");

  function showMenu() {
    renderMasMenu({
      contentEl,
      onOpenPerfil: () => { closeSheet(sheetEl, backdropEl); onSwitchToPerfil(); },
      onOpenWeights: () => { pushBackGuard(showMenu); showWeights(); },
      onClose: () => closeSheet(sheetEl, backdropEl),
    });
  }

  function showWeights() {
    renderMobileWeightsSheet({
      contentEl, apiFetch, groupId,
      onBack: () => { popBackGuard(); showMenu(); },
      onClose: () => { popBackGuard(); closeSheet(sheetEl, backdropEl); },
    });
  }

  showMenu();
  openSheet(sheetEl, backdropEl);
}
