// mobileTeacher.js — Bootstrap for the mobile teacher panel.
// Activated only on ≤768px viewports. Overlays the desktop panel with a fixed UI.

import { apiFetch, logout } from "../../shared/js/auth.js";
import { mtFetchGroups } from "./mobileTeacherData.js";
import { initMtCuaderno } from "./mobileTeacherCuaderno.js";
import { initMtAgenda } from "./mobileTeacherAgenda.js";
import { initMtPerfil } from "./mobileTeacherPerfil.js";
import { setupIOSViewportReset } from "./iosViewportReset.js";
import { getSavedGroupId } from "./subjects/subjectPrefs.js";
import { armBaseGuard } from "../../shared/js/mobileBackGuard.js";

const SVG_BOOK     = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
const SVG_CALENDAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const SVG_USER     = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

function _isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function _buildShell() {
  const app = document.createElement("div");
  app.className = "mt-app";
  app.id = "mtApp";
  app.innerHTML = `
    <!-- Pages -->
    <div class="mt-page" id="mtPageCuaderno">
      <div class="mt-header" id="mtHeaderCuaderno"></div>
    </div>
    <div class="mt-page mt-page--hidden" id="mtPageAgenda">
      <div class="mt-header" id="mtHeaderAgenda"></div>
    </div>
    <div class="mt-page mt-page--hidden" id="mtPagePerfil">
      <div class="mt-header" id="mtHeaderPerfil"></div>
    </div>

    <!-- Bottom sheet -->
    <div class="mt-backdrop" id="mtBackdrop"></div>
    <div class="mt-sheet" id="mtSheet">
      <div class="mt-sheet-handle"></div>
      <div class="mt-sheet-content" id="mtSheetContent"></div>
    </div>

    <!-- Stacked bottom sheet (Trimestre: estadísticas + informe) -->
    <div class="mt-backdrop mt-backdrop--stacked" id="mtBackdrop2"></div>
    <div class="mt-sheet mt-sheet--stacked" id="mtSheet2">
      <div class="mt-sheet-handle"></div>
      <div class="mt-sheet-content" id="mtSheetContent2"></div>
    </div>

    <!-- Bottom tab bar -->
    <nav class="mt-tabs" id="mtTabs">
      <button class="mt-tab mt-tab--active" data-tab="cuaderno">
        ${SVG_BOOK}
        <span>Cuaderno</span>
      </button>
      <button class="mt-tab" data-tab="agenda">
        ${SVG_CALENDAR}
        <span>Agenda</span>
      </button>
      <button class="mt-tab" data-tab="perfil">
        ${SVG_USER}
        <span>Perfil</span>
      </button>
    </nav>`;
  return app;
}

function _wireTabs(appEl) {
  const tabs  = appEl.querySelectorAll(".mt-tab");
  const pages = {
    cuaderno: appEl.querySelector("#mtPageCuaderno"),
    agenda:   appEl.querySelector("#mtPageAgenda"),
    perfil:   appEl.querySelector("#mtPagePerfil"),
  };

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle("mt-tab--active", t.dataset.tab === target));
      Object.entries(pages).forEach(([name, pageEl]) => {
        pageEl.classList.toggle("mt-page--hidden", name !== target);
      });
    });
  });
}

export async function initMobileTeacher(ctx) {
  if (!_isMobile()) return;

  armBaseGuard();

  const appEl = _buildShell();
  document.getElementById("teacherApp").appendChild(appEl);
  _wireTabs(appEl);
  setupIOSViewportReset(appEl);

  const sheetEl    = appEl.querySelector("#mtSheet");
  const backdropEl = appEl.querySelector("#mtBackdrop");
  const sheetEl2    = appEl.querySelector("#mtSheet2");
  const backdropEl2 = appEl.querySelector("#mtBackdrop2");

  const mtState = {
    currentGroupId:    null,
    currentSubjectName: "",
    trimester:      null,
    weekOffset:     0,
    cuadernoView:   "student",
    dateFilter:     "today",
    groups:         [],
    students:       [],
    sessions:       [],
  };

  // Load groups first — everything depends on them
  mtState.groups = await mtFetchGroups(apiFetch).catch(() => []);
  if (mtState.groups.length > 0) {
    const savedGroupId = getSavedGroupId();
    const saved = mtState.groups.find(g => g.id === savedGroupId);
    mtState.currentGroupId = saved ? saved.id : mtState.groups[0].id;
  }

  const studentNotes = ctx.state?.data?.studentNotes || [];

  await initMtCuaderno({
    pageEl:   appEl.querySelector("#mtPageCuaderno"),
    headerEl: appEl.querySelector("#mtHeaderCuaderno"),
    sheetEl,
    backdropEl,
    sheetEl2,
    backdropEl2,
    mtState,
    apiFetch,
    studentNotes,
  });

  await initMtAgenda({
    pageEl:   appEl.querySelector("#mtPageAgenda"),
    headerEl: appEl.querySelector("#mtHeaderAgenda"),
    sheetEl,
    backdropEl,
    mtState,
    apiFetch,
  });

  initMtPerfil({
    pageEl:   appEl.querySelector("#mtPagePerfil"),
    headerEl: appEl.querySelector("#mtHeaderPerfil"),
    mtState,
    ctx,
    onLogout: async () => {
      await logout().catch(() => {});
      window.location.href = "/login";
    },
  });
}
