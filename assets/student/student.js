// assets/student/student.js
import { DOM, STATE, APP_VERSION } from "./state/state.js";
import {
  ensureToday,
  ensureThread,
  setActiveThreadForMode,
  normalizeItem,
  computeItemsForMode,
  getThreadHistory,
  setThreadHistory,
} from "./state/storage.js";
import { asciiToLatex, looksMath, isMathOnly } from "./controllers/math.js";
import { toggleMic, stopMic } from "./controllers/mic.js";
import { initAttach } from "./attachments/attach.js";
import { createPreviewRenderer } from "./ui/preview.js";
import { createInputHelpers } from "./ui/input.js";
import { createTyping } from "./ui/typing.js";
import { createChatRenderer } from "./render/chatRenderer.js";
import { createComposerHelpers } from "./controllers/composer.js";
import createAttachmentUI from "./attachments/attachmentsui.js";
import { setupIframeBridge } from "./bridge/iframebridge.js";
import { createSendController, installAttachInvalidHandler, installMicErrorHandler } from "./controllers/send.js";
import { createInitialScrollLock, runInitialBoot } from "./boot/initial.js";
import { installMicGuards, installBackStopsMic, installEnterToSend } from "./boot/guards.js";
import { setupIOSViewportFix } from "../shared/js/iosviewportfix.js";
import { askGPT } from "../shared/js/chatapi.js";
import { bindCoreUI } from "./bindings/coreui.js";
import { initBoard } from "./board.js";
import { getFileKind } from "./lib/files.js";
import { createTicket, appendTicket } from "./lib/tickets.js";
import { pushUser } from "./lib/chatlog.js";
import { renderAgendaFromMock } from "./features/agenda/agendaUI.js";
import { createThreadPicker } from "./features/threadPicker/threadPicker.js";
import { getFile } from "../shared/js/filesStore.js";
import { apiFetch, clearSession, getTenantSlug } from "../shared/js/auth.js";
import { requireSessionOrRedirect } from "../shared/js/guard.js";
import {
  TENANT_LABELS,
  loadTenantCfg,
} from "../shared/js/tenant.js";

import {
  MODE_KEYS,
  MODE_LABEL,
  currentMode,
  modeChosen,
  waitingForMode,
  chooseMode,
  setPendingFirstQuestion,
  setWaitingForMode,
  getPendingFirstQuestion,
  clearPendingFirstQuestion,
  setSelectedTopic,
  getSelectedTopic,
} from "./controllers/mode.js";

// Version (visible en UI y útil para QA)
try {
  console.log(`📌 Tutordigital v${APP_VERSION}`);
  const subEl = document.querySelector("header .sub");
  if (subEl && !subEl.textContent.includes(`v${APP_VERSION}`)) {
    subEl.textContent = `${subEl.textContent} · v${APP_VERSION}`;
  }
} catch {}

// =========================
//  Tenant + Access
// =========================
const session = requireSessionOrRedirect({ requireTenant: true });
function getTenant() {
  return getTenantSlug() || "";
}
if (!session.tenantSlug) {
  window.location.replace("/");
}
if (session.tenantSlug) {
  try { localStorage.setItem("ttd_activeTenantSlug", session.tenantSlug); } catch {}
}

const fallbackTenantName = getTenant() === "instituto2"
  ? (TENANT_LABELS.instituto2 || "Instituto 2 (demo)")
  : (TENANT_LABELS.lyceo || "Lyceo (demo)");
const TENANT_CFG = loadTenantCfg(getTenant(), {
  name: fallbackTenantName,
  bgImage: "/assets/bg/instituto.jpg",
});

function getActiveUserKey() {
  return `ttd_activeUser_${getTenant()}`;
}

function loadActiveUser() {
  try {
    const raw = localStorage.getItem(getActiveUserKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveActiveUser(user) {
  try { localStorage.setItem(getActiveUserKey(), JSON.stringify(user)); } catch {}
}

function showStudentSignupModal() {
  const overlay = document.createElement("div");
  overlay.id = "studentSignupModal";
  overlay.className = "modalOverlay open";

  const card = document.createElement("div");
  card.className = "modalCard";

  card.innerHTML = `
    <div class="modalBrand">Tutordigital</div>
    <div class="modalTitle">Alta alumno</div>
    <label class="formField">
      <span>Nombre</span>
      <input id="studentSignupName" class="ttdInput" type="text" placeholder="Nombre y apellidos">
    </label>
    <label class="formField">
      <span>Código de grupo</span>
      <input id="studentSignupCode" class="ttdInput" type="text" placeholder="LYCEO-1A">
    </label>
    <button id="studentSignupSave" class="modalBtn" type="button">Entrar</button>
    <div class="modalHint">Ejemplo: LYCEO-1A / LYCEO-1B / INST2-1A</div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector("#studentSignupName");
  const codeInput = overlay.querySelector("#studentSignupCode");
  const saveBtn = overlay.querySelector("#studentSignupSave");
  const setFieldError = (input, active) => {
    if (!input) return;
    input.classList.toggle("is-error", !!active);
  };

  const resolveFromCode = (code) => {
    const v = String(code || "").trim().toUpperCase();
    const map = {
      lyceo: {
        "LYCEO-1A": { groupName: "1º ESO A" },
        "LYCEO-1B": { groupName: "1º ESO B" }
      },
      instituto2: {
        "INST2-1A": { groupName: "1º ESO A" }
      }
    };
    return map[getTenant()]?.[v] || null;
  };

  saveBtn.addEventListener("click", () => {
    const displayName = String(nameInput.value || "").trim();
    const code = String(codeInput.value || "").trim();
    const resolved = resolveFromCode(code);
    if (!displayName || !resolved) {
      setFieldError(nameInput, !displayName);
      setFieldError(codeInput, !resolved);
      (displayName ? codeInput : nameInput).focus();
      return;
    }
    const data = loadTeacherData();
    const groupId = data?.groups?.find(g => g.name === resolved.groupName)?.id;
    if (!groupId) {
      setFieldError(codeInput, true);
      codeInput.focus();
      return;
    }
    const user = {
      userId: `u_${Date.now()}`,
      role: "student",
      displayName,
      groupId
    };
    saveActiveUser(user);
    window.location.reload();
  });

  nameInput?.addEventListener("input", () => setFieldError(nameInput, false));
  codeInput?.addEventListener("input", () => setFieldError(codeInput, false));
  nameInput?.focus();
}

const ACTIVE_USER = loadActiveUser();
if (!ACTIVE_USER || ACTIVE_USER.role !== "student") {
  showStudentSignupModal();
}

function updateTenantStatus() {
  const status = document.getElementById("tenantStatus");
  if (!status) return;
  let groupLabel = "";
  const data = loadTeacherData();
  if (ACTIVE_USER?.groupId && data?.groups) {
    const group = data.groups.find(g => g.id === ACTIVE_USER.groupId);
    if (group?.name) groupLabel = group.name;
  }
  const tenantLabel = TENANT_CFG?.name || getTenant();
  status.textContent = `Centro: ${tenantLabel} · Rol: Alumno${groupLabel ? ` · Grupo: ${groupLabel}` : ""}`;
}

// =========================
//  Theme override (manual)
// =========================
function getThemeKey() {
  return `ttdTheme_${getTenant()}`;
}

function applyTheme(theme) {
  const t = (theme === "dark" || theme === "light") ? theme : "";
  if (t) {
    document.documentElement.dataset.theme = t;
  } else {
    delete document.documentElement.dataset.theme;
  }
  try { localStorage.setItem(getThemeKey(), t); } catch {}
}

function updateThemeToggleLabel(btn) {
  if (!btn) return;
  const current = document.documentElement.dataset.theme || "dark";
  btn.textContent = current === "dark" ? "Claro" : "Oscuro";
}

try {
  const saved = localStorage.getItem(getThemeKey());
  if (saved === "dark" || saved === "light") applyTheme(saved);
} catch {}

try {
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    updateThemeToggleLabel(themeBtn);
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      updateThemeToggleLabel(themeBtn);
    });
  }
} catch {}

try {
  const homeLink = document.getElementById("homeLink");
  if (homeLink) {
    homeLink.href = `/index.html`;
    homeLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      window.location.href = `/index.html`;
    });
  }
} catch {}

try {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await apiFetch("/api/v1/auth/logout", { method: "POST" });
      } catch {}
      clearSession();
      window.location.href = "/index.html";
    });
  }
} catch {}

try {
  updateTenantStatus();
} catch {}

window.addEventListener("message", (ev) => {
  try {
      if (ev.origin !== window.location.origin) return;
    const d = ev.data || {};
    if (d.type === "ttd:set-theme") {
      applyTheme(d.theme);
    }
  } catch {}
});

// =========================
//  iOS: mantener el composer visible incluso con teclado abierto
// =========================
try {
  setupIOSViewportFix();
} catch (e) {
  console.warn("setupIOSViewportFix() falló (no bloquea la app):", e);
}

// =========================
//  Stop mic when leaving / minimizing / closing
// =========================
installMicGuards({ stopMic });

const {
  chat,
  messages,
  inp,
  btn,
  sendIn,
  filePick,
  kbd,
  pad,
  eqPreview,
  micBtn,
  btnDeberes,
  btnExamen,
  btnTrabajo,
} = DOM;
renderAgendaFromMock({ btnDeberes, btnExamen, btnTrabajo });

function getTeacherDataKey() {
  return `ttd_teacherData_${getTenant()}`;
}

function getTeacherGroupKey() {
  return `ttd_teacherGroup_${getTenant()}`;
}
const TASK_TYPE_LABELS = {
  homework: "Deberes",
  exam: "Exámenes",
  work: "Trabajos",
};
let teacherTasksById = new Map();
let teacherTasksGroupName = "";
let activeViewerUrl = "";

function formatFileSize(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function inferMimeType(name) {
  const value = String(name || "").toLowerCase();
  if (value.endsWith(".pdf")) return "application/pdf";
  if (value.endsWith(".png")) return "image/png";
  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
  if (value.endsWith(".webp")) return "image/webp";
  if (value.endsWith(".gif")) return "image/gif";
  return "";
}

function isImageType(type) {
  return Boolean(type && type.startsWith("image/"));
}

function loadTeacherData() {
  try {
    const raw = localStorage.getItem(getTeacherDataKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getActiveTeacherGroupId(data) {
  if (ACTIVE_USER?.groupId) return ACTIVE_USER.groupId;
  const stored = localStorage.getItem(getTeacherGroupKey());
  if (stored) return stored;
  return data?.groups?.[0]?.id || null;
}

function formatDueDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function ensureStudentTaskModal() {
  let modal = document.getElementById("studentTaskModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "studentTaskModal";
  modal.className = "taskModalOverlay";
  modal.innerHTML = `
    <div class="taskModalCard">
      <div class="taskModalHeader">
        <h3 id="studentTaskTitle">Tarea</h3>
        <button class="taskModalClose" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="taskModalBody" id="studentTaskBody"></div>
      <div class="taskModalAttachments">
        <div class="taskModalLabel">Adjuntos</div>
        <ul class="taskModalList" id="studentTaskAttachments"></ul>
        <p class="taskModalEmpty" id="studentTaskEmpty">Sin adjuntos.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.classList.contains("taskModalClose")) {
      modal.classList.remove("open");
    }
  });
  modal.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-file-action]");
    if (!button) return;
    const id = button.dataset.fileId;
    const action = button.dataset.fileAction;
    try {
      const record = await getFile(id);
      if (!record || !record.blob) return;
      const inferred = inferMimeType(record.name);
      const type = record.type || inferred || "";
      if (action === "open" && isImageType(type)) {
        openFileViewer(record);
        return;
      }
      downloadFile(record);
    } catch (error) {
      console.warn("No se pudo abrir el adjunto:", error);
    }
  });
  return modal;
}

function ensureFileViewerModal() {
  let modal = document.getElementById("studentFileViewer");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "studentFileViewer";
  modal.className = "taskModalOverlay";
  modal.innerHTML = `
    <div class="taskModalCard taskViewerCard">
      <div class="taskModalHeader">
        <h3 id="studentViewerTitle">Adjunto</h3>
        <button class="taskModalClose" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="taskViewerBody" id="studentViewerBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.classList.contains("taskModalClose")) {
      modal.classList.remove("open");
      const body = modal.querySelector("#studentViewerBody");
      if (body) body.innerHTML = "";
      if (activeViewerUrl) {
        URL.revokeObjectURL(activeViewerUrl);
        activeViewerUrl = "";
      }
    }
  });
  return modal;
}

function openFileViewer(file) {
  const inferred = inferMimeType(file.name);
  const type = file.type || inferred || "";
  if (!isImageType(type)) {
    downloadFile(file);
    return;
  }
  const modal = ensureFileViewerModal();
  const body = modal.querySelector("#studentViewerBody");
  const title = modal.querySelector("#studentViewerTitle");
  if (activeViewerUrl) {
    URL.revokeObjectURL(activeViewerUrl);
    activeViewerUrl = "";
  }
  const sourceBlob = file.blob;
  const blob =
    type && sourceBlob && sourceBlob.type !== type
      ? sourceBlob.slice(0, sourceBlob.size, type)
      : sourceBlob;
  const url = URL.createObjectURL(blob);
  activeViewerUrl = url;
  if (title) title.textContent = file.name || "Adjunto";
  if (body) {
    body.innerHTML = `<img class="taskViewerImage" src="${url}" alt="Adjunto">`;
  }
  modal.classList.add("open");
}

function downloadFile(file) {
  const inferred = inferMimeType(file.name);
  const type = file.type || inferred || "";
  const sourceBlob = file.blob;
  const blob =
    type && sourceBlob && sourceBlob.type !== type
      ? sourceBlob.slice(0, sourceBlob.size, type)
      : sourceBlob;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name || "adjunto";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function openTeacherTaskFromAgenda(taskId) {
  const task = teacherTasksById.get(taskId);
  if (!task) return;
  openStudentTaskModal(task, teacherTasksGroupName);
}

function initAgendaTaskHandlers() {
  const agenda = document.getElementById("agenda");
  if (!agenda) return;
  agenda.addEventListener("click", (event) => {
    const target = event.target.closest("[data-task-id]");
    if (!target) return;
    event.preventDefault();
    openTeacherTaskFromAgenda(target.dataset.taskId);
  });
  agenda.addEventListener("keydown", (event) => {
    const target = event.target.closest("[data-task-id]");
    if (!target) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTeacherTaskFromAgenda(target.dataset.taskId);
    }
  });
}

function openStudentTaskModal(task, groupName) {
  const modal = ensureStudentTaskModal();
  const title = modal.querySelector("#studentTaskTitle");
  const body = modal.querySelector("#studentTaskBody");
  const list = modal.querySelector("#studentTaskAttachments");
  const empty = modal.querySelector("#studentTaskEmpty");

  title.textContent = task.title;
  body.innerHTML = `
    <div><strong>Tipo:</strong> ${TASK_TYPE_LABELS[task.type] || "Tarea"}</div>
    <div><strong>Grupo:</strong> ${groupName || "-"}</div>
    <div><strong>Entrega:</strong> ${task.dueDate}</div>
    ${task.desc ? `<div><strong>Descripción:</strong></div><div>${task.desc}</div>` : ""}
  `;

    list.innerHTML = "";
    const attachments = task.attachments || [];
    attachments.forEach((file) => {
      const inferred = inferMimeType(file.name);
      const type = file.type || inferred || "";
      const canOpen = isImageType(type);
      const li = document.createElement("li");
      li.className = "taskModalItem";
      li.innerHTML = `
        <div class="taskModalInfo">
          <div class="taskModalName">${file.name}</div>
          <div class="taskModalMeta">${formatFileSize(file.size)}</div>
        </div>
        <div class="taskModalActions">
        ${canOpen ? `<button type="button" data-file-action="open" data-file-id="${file.id}">Abrir</button>` : ""}
        <button type="button" data-file-action="download" data-file-id="${file.id}">Descargar</button>
        </div>
      `;
      list.appendChild(li);
    });
  empty.style.display = attachments.length ? "none" : "block";
  modal.classList.add("open");
}

function renderTeacherTasksIntoAgenda() {
  const data = loadTeacherData();
  if (!data || !data.tasks || !data.groups) return;

  const agenda = document.getElementById("agenda");
  if (!agenda) return;

  const panel = document.getElementById("teacherTasksPanel");
  if (panel) panel.remove();

  const groupId = getActiveTeacherGroupId(data);
  const group = data.groups.find((item) => item.id === groupId);
  teacherTasksGroupName = group?.name || "";
  const tasks = data.tasks
    .filter((task) => task.groupId === groupId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (!tasks.length) return;

  teacherTasksById = new Map(tasks.map((task) => [task.id, task]));

  const byType = {
    homework: [],
    exam: [],
    work: [],
  };

  tasks.forEach((task) => {
    if (byType[task.type]) byType[task.type].push(task);
  });

  const targets = [
    { type: "homework", btn: btnDeberes },
    { type: "exam", btn: btnExamen },
    { type: "work", btn: btnTrabajo },
  ];

  targets.forEach(({ type, btn }) => {
    if (!btn) return;
    let list = btn.querySelector("ul.items");
    if (!list) {
      list = document.createElement("ul");
      list.className = "items";
      btn.appendChild(list);
    }
    list.innerHTML = "";

    if (!byType[type].length) {
      const li = document.createElement("li");
      li.textContent = "Sin tareas.";
      list.appendChild(li);
      return;
    }

    byType[type].forEach((task) => {
      const li = document.createElement("li");
      const due = task.dueDate ? ` · ${formatDueDate(task.dueDate)}` : "";
      const link = document.createElement("span");
      link.className = "agendaTaskLink";
      link.dataset.taskId = task.id;
      link.setAttribute("role", "button");
      link.tabIndex = 0;
      link.textContent = `${task.title}${due}`;
      li.appendChild(link);
      list.appendChild(li);
    });
  });
}

renderTeacherTasksIntoAgenda();
initAgendaTaskHandlers();

try {
  initBoard({ filePickEl: filePick });
} catch (e) {
  console.warn("initBoard() falló:", e);
}

// =========================
//  Stop mic when clicking "Inicio" back button in header
// =========================
installBackStopsMic({ stopMic });

const scrollEl = chat; // main con scroll
const chatList = messages || chat; // donde pintamos burbujas
// Estado adjunto actual (imagen)
let pendingImage = null;
let autoScrollUnlocked = false;
const initialScroll = createInitialScrollLock({
  scrollEl,
  inp,
  micBtn,
  kbd,
  btn,
  btnDeberes,
  btnExamen,
  btnTrabajo,
  unlockOnFirstSendOnly: true,
});

// =========================
//  Debug helpers (errores más útiles)
// =========================
const __TTD_DEBUG = (() => {
  try {
    const qs = String(window.location.search || "");
    if (/(?:\?|&)debug=1(?:&|$)/.test(qs)) {
      try { localStorage.setItem("ttd_debug", "1"); } catch {}
      return true;
    }
    try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
  } catch {}
  return false;
})();

// =========================
//  Threaded history (por tarea)
// =========================
let sendText = async () => {};
let addTopicChipsRef = null;
let renderFromHistoryRef = () => {};
let addRef = (...args) => {};

const threadPicker = createThreadPicker({
  chatList,
  scrollEl,
  MODE_KEYS,
  MODE_LABEL,
  computeItemsForMode,
  normalizeItem,
  getThreadHistory,
  setThreadHistory,
  ensureThread,
  setActiveThreadForMode,
  setSelectedTopic,
  getPendingFirstQuestion,
  clearPendingFirstQuestion,
  pushUser,
  chooseMode,
  setWaitingForMode,
  setPendingFirstQuestion,
  addTopicChips: (...args) => addTopicChipsRef && addTopicChipsRef(...args),
  renderFromHistory: () => renderFromHistoryRef(),
  sendText: (...args) => sendText(...args),
  inp,
  add: (...args) => addRef(...args),
});

const showTypePicker = threadPicker.showTypePicker;
const startTypeSelection = threadPicker.startTypeSelection;
const getHistory = threadPicker.getHistory;
const setHistory = threadPicker.setHistory;

// =========================
//  Composer helpers (extraídos)
// =========================
const __composer = createComposerHelpers({
  inp,
  btn,
  pad,
  getModeChosen: () => modeChosen,
  getWaitingForMode: () => waitingForMode,
  getPendingImage: () => pendingImage,
});

const {
  autoGrowInput,
  update,
  ensureComposerInteractive,
  updatePadLayout,
} = __composer;

// iOS/layout: el footer sube exactamente lo que mida el pad
window.__ttdUpdateLayout = updatePadLayout;
try {
  window.addEventListener("resize", () => requestAnimationFrame(updatePadLayout));
} catch {}
try {
  requestAnimationFrame(updatePadLayout);
} catch {}

// Placeholders de UI (se inicializan más abajo)
let showTyping = () => {};
let hideTyping = () => {};
let showAttachPreview = () => {};
let hideAttachPreview = () => {};

// aplica ya al cargar
ensureComposerInteractive();
update();
try { ensureToday?.(); } catch {}

// =========================
//  Helpers (preview + inserción)
// =========================
const { renderPreview } = createPreviewRenderer({
  inp,
  eqPreview,
  looksMath,
  isMathOnly,
  asciiToLatex,
});

const { insertAtCursor } = createInputHelpers({
  inp,
  update,
  renderPreview,
  ensureInteractive: ensureComposerInteractive,
});

// =========================
//  UI helpers (renderer): extraídos a mod.js
// =========================
const __chatUI = createChatRenderer({
  chatList,
  scrollEl,
  looksMath,
  asciiToLatex,
  getHistory,
  setHistory,
  // Evita que el boot inicial “se coma” la cabecera de Agenda en móvil.
  // Solo habilitamos autoscroll cuando el alumno envía su primer mensaje.
  shouldAutoScroll: () => autoScrollUnlocked,
});

const add = __chatUI.add;
const addTeacherCTA = __chatUI.addTeacherCTA;
const addImageAttachment = __chatUI.addImageAttachment;
const addFileAttachment = __chatUI.addFileAttachment;
const addTopicChips = __chatUI.addTopicChips;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

addTopicChipsRef = addTopicChips;
renderFromHistoryRef = renderFromHistory;
addRef = add;

function collectLastMessages(limit = 12) {
  try {
    const hist = getHistory();
    if (!Array.isArray(hist)) return [];
    return hist.slice(-limit).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: String(m?.content || ""),
    }));
  } catch {
    return [];
  }
}

function getAttachmentSnapshot() {
  try {
    const pending = pendingImage;
    const file = pending?.file || null;
    if (!file) return null;
    const info = getFileKind(file);
    return {
      kind: info.kind,
      name: info.name || "",
      mime: info.type || info.suggestedMime || "",
    };
  } catch {
    return null;
  }
}

function createTeacherTicket(type) {
  const ticket = createTicket({
    type,
    mode: currentMode,
    lastMessages: collectLastMessages(12),
    attachment: getAttachmentSnapshot(),
  });
  const res = appendTicket(ticket);
  if (!res.ok) return null;
  try {
    window.dispatchEvent(new CustomEvent("ttd:teacher-ticket", { detail: ticket }));
  } catch {}
  return ticket;
}

function pushTeacherCTA(type) {
  return addTeacherCTA?.(type, {
    onClick: ({ btn }) => {
      const ticket = createTeacherTicket(type);
      try {
        if (btn) {
          btn.textContent = "Enviado ✓";
        }
      } catch {}
      if (!ticket) return;
    },
  });
}

if (__TTD_DEBUG) {
  try {
    window.ttdPushTeacherCTA = (type) => pushTeacherCTA(type);
  } catch {}
}
// =========================
//  UI módulos (typing + adjuntos + bridge iframe)
// =========================
const __typing = createTyping({ chatList, scrollEl });
showTyping = __typing.showTyping;
hideTyping = __typing.hideTyping;

const __attachUI = createAttachmentUI({
  // Donde se pinta la “pastilla” del adjunto (encima del input).
  // Si por lo que sea no existe, caemos al propio composer.
  rootEl: document.getElementById('attachRow') || sendIn,
  inp,
  update,
  onClear: () => {
    pendingImage = null;
  },
});
showAttachPreview = __attachUI.showAttachPreview;
hideAttachPreview = __attachUI.hideAttachPreview;

const showModePicker = () => {
  showTypePicker();
};

const __send = createSendController({
  STATE,
  inp,
  btn,
  sendIn,
  forceScrollToBottom: () => {
    try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
  },
  getModeChosen: () => modeChosen,
  getSelectedTopic: () => getSelectedTopic(),
  setPendingFirstQuestion,
  showModeQuestion: showModePicker,
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => { pendingImage = v; },
  hideAttachPreview,
  setAttachSending: __attachUI.setSending,
  update,
  renderPreview,
  autoGrowInput,
  stopMic,
  add,
  addImageAttachment,
  addFileAttachment,
  setAutoScrollUnlocked: () => { autoScrollUnlocked = true; },
  getHistory,
  setHistory,
  askGPT,
  getCurrentMode: () => currentMode,
  showTyping,
  hideTyping,
  rerenderPendingMath,
  unlockInitialScroll: initialScroll.unlockInitialScroll,
  debug: __TTD_DEBUG,
});
const safeSend = __send.safeSend;
sendText = __send.sendText;

// Si cambiamos entre móvil/desktop, recoloca el preview donde toca
window.addEventListener("resize", () => {
  try {
    if (typeof __attachUI?.reflowPreview === "function") __attachUI.reflowPreview();
  } catch {}
});

setupIframeBridge({
  inp,
  insertAtCursor,
  update,
  renderPreview,
  safeSend,
  expectedOrigin: window.location.origin,
});
// ✅ binding único (coreUI.js)
async function pdfFirstPageToPngDataURL(file, { maxWidth = 1400, scale = 1.6 } = {}) {
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib?.getDocument) return null;

    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale });
    let targetScale = scale;
    if (viewport.width > maxWidth) {
      targetScale = (maxWidth / viewport.width) * scale;
    }
    const vp = page.getViewport({ scale: targetScale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);

    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("pdfFirstPageToPngDataURL failed:", e);
    return null;
  }
}

const bindOnce = bindCoreUI({
  // DOM
  inp,
  btn,
  kbd,
  pad,
  micBtn,
  btnDeberes,
  btnExamen,
  btnTrabajo,
  scrollEl,

  // deps
  STATE,
  stopMic,
  toggleMic,
  insertAtCursor,

  // features
  initAttach,
  startTypeSelection,
  MODES: MODE_KEYS,

  // storage/history (para mode y para pintar)
  getHistory,
  setHistory,

  // send (coreUI llama a safeSend)
  safeSend,
  sendText,

  // helpers/ui
  ensureComposerInteractive,
  autoGrowInput,
  update,
  renderPreview,
  fileToDataURL,
  pdfFirstPageToPngDataURL,

  // pending image (para que coreUI.js no “toque” variables del index)
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => {
    pendingImage = v;
  },

  // attach preview UI
  showAttachPreview,
  hideAttachPreview,

  // layout
  updatePadLayout,

  // chat renderer
  add,
  addImageAttachment,
});

bindOnce();

// =========================
//  Enter envía / Shift+Enter salto de línea
// =========================
installEnterToSend({ inp, safeSend });

// =========================
//  Helpers adjuntos
// =========================
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
installAttachInvalidHandler({
  add,
  getHistory,
  setHistory,
  clearPending: () => { pendingImage = null; },
  hideAttachPreview,
  update,
  renderPreview,
});

installMicErrorHandler({ add, getHistory, setHistory });

runInitialBoot({
  add,
  getHistory,
  setHistory,
  scrollEl,
  renderFromHistory,
  rerenderPendingMath,
  ensureComposerInteractive,
  update,
  renderPreview,
  // No bloqueamos el scroll del usuario; solo desactivamos auto-scroll programático.
});
