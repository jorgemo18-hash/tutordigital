// mobileAdminSheets.js — Generic bottom-sheet open/close for the mobile
// admin panel. Wired into mobileBackGuard so an iOS swipe-back gesture
// closes the sheet instead of navigating away — same pattern as the
// teacher mobile panel's mobileTeacherSheets.js. Class names (.sheet,
// .sheet-scrim, "open") match the reference design's sheet component.

import { pushBackGuard, popBackGuard } from "../../shared/js/mobileBackGuard.js";

function _closeSheetVisual(sheetEl, backdropEl) {
  sheetEl.classList.remove("open");
  backdropEl.classList.remove("open");
  document.body.style.overflow = "";
}

export function openSheet(sheetEl, backdropEl) {
  backdropEl.classList.add("open");
  requestAnimationFrame(() => sheetEl.classList.add("open"));
  document.body.style.overflow = "hidden";
  pushBackGuard(() => _closeSheetVisual(sheetEl, backdropEl));
}

export function closeSheet(sheetEl, backdropEl) {
  _closeSheetVisual(sheetEl, backdropEl);
  popBackGuard();
}
