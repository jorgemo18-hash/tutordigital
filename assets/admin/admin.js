import {
  apiFetch,
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
} from "../shared/js/auth.js";
import { initAdminGroups } from "./modules/admin-groups.js";

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SUBJECTS = [
  "Matemáticas",
  "Lengua",
  "Inglés",
  "Física y Química",
  "Biología",
  "Historia",
  "Geografía",
  "Filosofía",
  "Economía",
  "Tecnología",
  "Música",
  "Educación Física",
  "Plástica",
  "Francés",
];

const SUBJECT_PLACEHOLDER = "__placeholder__";
const SUBJECT_OTHER = "__OTHER__";

const STAGES = [
  { key: "primaria",  label: "Primaria",      years: [1, 2, 3, 4, 5, 6] },
  { key: "eso",       label: "ESO",            years: [1, 2, 3, 4] },
  { key: "bachiller", label: "Bachillerato",   years: [1, 2] },
];

// ── State ──────────────────────────────────────────────────────────────────

let state = {
  me: null,
  tenantSlug: "",
  tenantName: "",
  memberships: [],
  groups: [],
  teachers: [],
  customSubjects: [],
  allGroups: [],
  selectedGroupIds: new Set(),
  // GRUPOS navigation
  adminGroups: [],
  adminGroupsLoaded: false,
  gruposLevel: 1,       // 1 = etapas, 2 = cursos, 3 = lista
  gruposStage: null,    // "primaria" | "eso" | "bachiller"
  gruposYear: null,     // 1–6
  // DOCENTES
  teachersLoaded: false,
  // ALUMNOS
  activeGroupForStudents: null,
  groupStudents: [],
};

const selectedSubjects = new Set();
let groupsModule = null;

// ── DOM refs: header / wizard ──────────────────────────────────────────────

const tenantEl = document.getElementById("adminTenant");
const errorEl = document.getElementById("adminError");
const resultEl = document.getElementById("adminInviteResult");
const inviteResultEl = document.getElementById("inviteResult");
const inviteEmailValueEl = document.getElementById("inviteEmailValue");
const clearInviteResultBtn = document.getElementById("clearInviteResultBtn");

const teacherEmail = document.getElementById("teacherEmail");
const teacherDisplayName = document.getElementById("teacherDisplayName");

const subjectSelect = document.getElementById("subjectSelect");
const subjectAddWrap = document.getElementById("subjectAddWrap");
const subjectAddInput = document.getElementById("subjectAddInput");
const subjectAddBtn = document.getElementById("subjectAddBtn");
const subjectChips = document.getElementById("subjectChips");

const stageSelect = document.getElementById("stageSelect");
const yearSelect = document.getElementById("yearSelect");
const trackSelect = document.getElementById("trackSelect");
const customTrackWrap = document.getElementById("customTrackWrap");
const customTrackInput = document.getElementById("customTrackInput");
const groupChips = document.getElementById("groupChips");
const groupsHint = document.getElementById("groupsHint");
const tutorGroupSelect = document.getElementById("tutorGroupSelect");

const groupsEls = {
  stageSelect,
  yearSelect,
  trackSelect,
  customTrackWrap,
  customTrackInput,
  trackPills: null,
  groupGrid: null,
  groupChips,
  groupsHint,
  tutorGroupSelect,
  adminError: errorEl,
};

const createTeacherInviteBtn = document.getElementById("createTeacherInviteBtn");
const inviteStartBtn = document.getElementById("inviteStartBtn");
const toGroupsBtn = document.getElementById("toGroupsBtn");
const toTutorBtn = document.getElementById("toTutorBtn");
const inviteStepBasics = document.getElementById("inviteStepBasics");
const inviteStepSubjects = document.getElementById("inviteStepSubjects");
const inviteStepGroups = document.getElementById("inviteStepGroups");
const inviteStepTutor = document.getElementById("inviteStepTutor");
const summarySubjectChips = document.getElementById("summarySubjectChips");
const summaryGroupChips = document.getElementById("summaryGroupChips");
const summaryTutorChip = document.getElementById("summaryTutorChip");
const asTeacherBtn = document.getElementById("adminAsTeacher");
const asStudentBtn = document.getElementById("adminAsStudent");
const logoutBtn = document.getElementById("adminLogout");
const teachersList = document.getElementById("teachersList");

// ── Utilities ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeLabel(value) {
  return String(value || "").trim();
}

function uniq(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((v) => String(v).trim())));
}

function normalizeRole(m) {
  const role =
    m?.role ||
    m?.member_role ||
    m?.membership_role ||
    (Array.isArray(m?.roles) ? m.roles[0] : "") ||
    "";
  return String(role || "").toLowerCase();
}

function tenantSlugOf(m) {
  return String(
    m?.tenant_slug ||
      m?.tenant?.slug ||
      m?.tenantSlug ||
      m?.tenant?.tenant_slug ||
      ""
  ).trim();
}

function tenantNameOf(m) {
  return String(m?.tenant?.name || m?.tenant_name || tenantSlugOf(m) || "").trim();
}

function isActiveMembership(m) {
  const status = String(m?.status || m?.membership_status || "").toLowerCase();
  return !status || status === "active";
}

function selectedTenantMemberships() {
  return (state.memberships || []).filter((m) => tenantSlugOf(m) === state.tenantSlug);
}

function roleFlags() {
  const scoped = selectedTenantMemberships().filter(isActiveMembership);
  const roles = scoped.map(normalizeRole);
  return {
    hasAdmin: roles.includes("admin"),
    hasTeacher: roles.includes("teacher"),
    hasStudent: roles.includes("student"),
  };
}

function mapApiError(status, body, fallback) {
  const code = String(body?.error?.code || "").toLowerCase();
  if (code === "forbidden_origin") return "Origen no permitido por seguridad.";
  if (code === "rate_limited") return "Demasiadas peticiones. Espera unos segundos.";
  if (code === "tenant_forbidden" || code === "forbidden_tenant") return "No tienes acceso a este centro.";
  if (code === "role_forbidden") return "Solo un admin puede hacer esta acción.";
  if (code === "invalid_group_ids") return "Hay grupos seleccionados que no pertenecen al centro.";
  if (code === "invalid_tutor_group") return "La tutoría debe ser uno de los grupos seleccionados.";
  if (code === "invalid_query") return "Parámetros inválidos al cargar datos del centro.";
  if (code === "duplicate_group") return "Ya existe un grupo con ese nombre en el centro.";
  if (code === "student_already_invited") return "Este email ya está autorizado para este grupo.";
  if (status === 404) return "Recurso no encontrado en backend.";
  return body?.error?.message || fallback || "No se pudo completar la operación.";
}

async function fetchJSON(path, options = {}) {
  const res = await apiFetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(mapApiError(res.status, body, `HTTP ${res.status}`));
    err.status = res.status;
    err.code = body?.error?.code || "";
    err.requestId = body?.requestId || "";
    throw err;
  }
  return body?.data || body || {};
}

function toItems(payload, fallbackKey) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (fallbackKey && Array.isArray(payload?.[fallbackKey])) return payload[fallbackKey];
  return [];
}

function renderChips(containerEl, items = [], onRemove) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  items.forEach(({ key, label }) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    const span = document.createElement("span");
    span.textContent = label;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "×";
    btn.addEventListener("click", () => onRemove(key));
    chip.append(span, btn);
    containerEl.appendChild(chip);
  });
}

async function copyToClipboard(text, feedbackEl) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  if (feedbackEl) {
    feedbackEl.textContent = "✓ Copiado al portapapeles";
    feedbackEl.classList.add("show");
    setTimeout(() => feedbackEl.classList.remove("show"), 2500);
  }
}

// ── Teacher invite wizard ──────────────────────────────────────────────────

function showInviteStep(stepName = "basics") {
  const map = {
    basics: inviteStepBasics,
    subjects: inviteStepSubjects,
    groups: inviteStepGroups,
    tutor: inviteStepTutor,
  };
  Object.entries(map).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", key !== stepName);
  });
  refreshInviteButtons();
}

function setError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || "";
}

function setResult(msg) {
  if (!resultEl) return;
  if (!msg) {
    resultEl.textContent = "";
    resultEl.classList.add("hidden");
    return;
  }
  resultEl.textContent = msg;
  resultEl.classList.remove("hidden");
}

function showInviteResult({ email, inviteUrl, emailSent = true }) {
  if (!inviteResultEl) return;
  if (inviteEmailValueEl) {
    const subtitle = emailSent
      ? `<div style="margin-top:8px; opacity:0.9;">Supabase ha enviado un email de invitación. También puedes copiar el enlace y enviarlo manualmente.</div>`
      : `<div style="margin-top:8px; color:#c9723a; font-weight:600;">⚠️ No se pudo enviar el email automáticamente. Copia este enlace y envíaselo al docente manualmente.</div>`;
    inviteEmailValueEl.innerHTML = `
      <div>Invitación para: <strong>${escHtml(email)}</strong></div>
      ${subtitle}
    `;
  }
  const linkBox = document.getElementById("inviteLinkBox");
  const linkInput = document.getElementById("inviteLinkInput");
  if (linkBox && linkInput && inviteUrl) {
    linkInput.value = inviteUrl;
    linkBox.hidden = false;
  } else if (linkBox) {
    linkBox.hidden = true;
  }
  inviteResultEl.hidden = false;
}

function resetInviteForm() {
  // Limpiar inputs básicos
  if (teacherEmail) teacherEmail.value = "";
  if (teacherDisplayName) teacherDisplayName.value = "";

  // Limpiar materias
  selectedSubjects.clear();
  renderSubjectChips();

  // Limpiar grupos y tutoría
  state.selectedGroupIds.clear();
  if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
  groupsModule?.renderGroupsUI();

  // Limpiar chips del resumen
  renderInviteSummary();

  // Volver al paso 1 y ocultar resultado
  showInviteStep("basics");
  setResult("");
  if (inviteResultEl) inviteResultEl.hidden = true;

  refreshInviteButtons();
}

function wireInviteResult() {
  const newInviteBtn = document.getElementById("newInviteBtn");
  if (newInviteBtn) {
    newInviteBtn.addEventListener("click", resetInviteForm);
  }

  if (clearInviteResultBtn && inviteResultEl) {
    clearInviteResultBtn.addEventListener("click", () => {
      inviteResultEl.hidden = true;
    });
  }
  const copyBtn = document.getElementById("copyLinkBtn");
  const linkInput = document.getElementById("inviteLinkInput");
  const feedback = document.getElementById("copyFeedback");
  if (copyBtn && linkInput) {
    copyBtn.addEventListener("click", () => {
      copyToClipboard(linkInput.value, feedback);
    });
  }
}

function renderSubjectSelect() {
  if (!subjectSelect) return;
  const fromTeachers = (state.teachers || []).flatMap((t) => t.subjects || []);
  const catalog = uniq([...DEFAULT_SUBJECTS, ...state.customSubjects, ...fromTeachers])
    .sort((a, b) => a.localeCompare(b, "es"));

  subjectSelect.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = SUBJECT_PLACEHOLDER;
  ph.textContent = "Selecciona materia...";
  ph.selected = true;
  ph.disabled = true;
  subjectSelect.appendChild(ph);

  catalog.forEach((subject) => {
    const opt = document.createElement("option");
    opt.value = subject;
    opt.textContent = subject;
    subjectSelect.appendChild(opt);
  });

  const other = document.createElement("option");
  other.value = SUBJECT_OTHER;
  other.textContent = "Otro…";
  subjectSelect.appendChild(other);

  subjectSelect.value = SUBJECT_PLACEHOLDER;
  refreshSubjectAddVisibility();
}

function renderSubjectChips() {
  const items = [...selectedSubjects]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((subject) => ({ key: subject, label: subject }));
  renderChips(subjectChips, items, (subject) => {
    selectedSubjects.delete(subject);
    renderSubjectChips();
  });
  renderInviteSummary();
  refreshInviteButtons();
}

function addSubject(subject) {
  const selected = normalizeLabel(subject);
  if (!selected || selected === SUBJECT_PLACEHOLDER || selected === SUBJECT_OTHER) return;
  selectedSubjects.add(selected);
  renderSubjectChips();
}

function refreshSubjectAddVisibility() {
  if (!subjectAddWrap || !subjectSelect) return;
  const show = String(subjectSelect.value || "") === SUBJECT_OTHER;
  subjectAddWrap.classList.toggle("hidden", !show);
  if (!show && subjectAddInput) subjectAddInput.value = "";
}

function groupLabelById(id) {
  const row = (state.allGroups || []).find(
    (g) => String(g?.id || g?.group_id || g?.slug || g?.code || "") === String(id)
  );
  return row?.name || row?.label || row?.title || row?.slug || String(id);
}

function renderInviteSummary() {
  const subjectItems = [...selectedSubjects]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((s) => ({ key: s, label: s }));
  renderChips(summarySubjectChips, subjectItems, (subject) => {
    selectedSubjects.delete(subject);
    renderSubjectChips();
  });

  const groupItems = [...state.selectedGroupIds]
    .map((id) => ({ key: id, label: groupLabelById(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  renderChips(summaryGroupChips, groupItems, (id) => {
    state.selectedGroupIds.delete(id);
    if (groupsEls.tutorGroupSelect?.value === id) groupsEls.tutorGroupSelect.value = "";
    groupsModule?.renderGroupsUI();
    groupsModule?.renderTutorOptions();
  });

  const tutorId = normalizeLabel(groupsEls.tutorGroupSelect?.value);
  const tutorItems = tutorId ? [{ key: tutorId, label: groupLabelById(tutorId) }] : [];
  renderChips(summaryTutorChip, tutorItems, () => {
    if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
    renderInviteSummary();
    refreshInviteButtons();
  });
}

function refreshInviteButtons() {
  const hasBasics = Boolean(normalizeLabel(teacherEmail?.value) && normalizeLabel(teacherDisplayName?.value));
  const hasSubjects = selectedSubjects.size > 0;
  const hasGroups = state.selectedGroupIds.size > 0;
  if (inviteStartBtn) inviteStartBtn.disabled = !hasBasics;
  if (toGroupsBtn) toGroupsBtn.disabled = !hasSubjects;
  if (toTutorBtn) toTutorBtn.disabled = !hasGroups;
  if (createTeacherInviteBtn) createTeacherInviteBtn.disabled = !(hasBasics && hasSubjects && hasGroups);
}

function addCustomSubject() {
  const value = normalizeLabel(subjectAddInput?.value);
  if (!value) return;
  state.customSubjects = uniq([...state.customSubjects, value]);
  addSubject(value);
  subjectAddInput.value = "";
  renderSubjectSelect();
  if (subjectSelect) subjectSelect.value = SUBJECT_OTHER;
  refreshSubjectAddVisibility();
  subjectAddInput?.focus();
}

function inviteStatusLabel(status = "") {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return "pendiente";
  if (s === "used") return "aceptada";
  if (s === "revoked") return "revocada";
  if (s === "expired") return "expirada";
  return "sin invitación";
}

function renderTeachers() {
  if (!teachersList) return;
  const items = state.teachers || [];
  if (!items.length) {
    teachersList.innerHTML = '<p class="emptyState">No hay docentes creados todavía.</p>';
    return;
  }

  teachersList.innerHTML = items
    .map((item) => {
      const subjects = item.subjects?.length
        ? item.subjects.map((s) => `<span class="chip">${escHtml(s)}</span>`).join("")
        : '<span class="teacherMeta">Sin materias</span>';
      const groups = item.groups?.length
        ? item.groups.map((g) => `<span class="chip">${escHtml(g.name)}${g.is_tutor ? " (tutoría)" : ""}</span>`).join("")
        : '<span class="teacherMeta">Sin grupos</span>';
      const invite = item.invite || null;
      const inviteLabel = inviteStatusLabel(invite?.status);

      return `
        <article class="teacherCard">
          <div class="teacherTop">
            <div>
              <div class="teacherName">${escHtml(item.display_name || "Docente")}</div>
              <div class="teacherMeta">${escHtml(item.email || "")}</div>
            </div>
            <div class="teacherMeta">Invitación: ${inviteLabel}</div>
          </div>
          <div class="chips">${subjects}</div>
          <div class="chips">${groups}</div>
          <div class="row">
            ${invite?.status === "pending" ? `<button class="btn ghost small" data-revoke-id="${invite.id}">Revocar</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

async function reloadTeachers() {
  const teachersRes = await fetchJSON("/api/v1/admin/teachers");
  state.teachers = toItems(teachersRes, "teachers");
  state.teachersLoaded = true;
  renderSubjectSelect();
  renderSubjectChips();
  renderTeachers();
}

async function createInvite() {
  setError("");
  setResult("");

  const email = normalizeLabel(teacherEmail?.value);
  const displayName = normalizeLabel(teacherDisplayName?.value);
  const subjects = [...selectedSubjects];
  const groupIds = [...state.selectedGroupIds];
  const tutorGroupId = normalizeLabel(groupsEls.tutorGroupSelect?.value) || null;

  if (!email) return setError("Introduce el email del docente.");
  if (!displayName) return setError("Introduce el nombre del docente.");
  if (!subjects.length) return setError("Añade al menos una materia.");
  if (!groupIds.length) return setError("Selecciona al menos un grupo (etapa + curso + vías).");

  const data = await fetchJSON("/api/v1/admin/teachers/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      display_name: displayName,
      subjects,
      group_ids: groupIds,
      tutor_group_id: tutorGroupId,
    }),
  });

  const invite = data?.invite || {};
  const emailSent = data?.email_sent !== false;
  setResult(emailSent ? "Invitación creada correctamente." : "Invitación creada. Email no enviado — copia el enlace manualmente.");
  showInviteResult({ email: invite.email || email, inviteUrl: invite.invite_url || "", emailSent });

  await reloadTeachers();
}

async function revokeInvite(inviteId) {
  setError("");
  await fetchJSON(`/api/v1/admin/teachers/teacher-invites/${inviteId}/revoke`, {
    method: "POST",
  });
  await reloadTeachers();
}

// ── GRUPOS section — 3-level navigation ───────────────────────────────────

function stageLabelFor(key) {
  return STAGES.find((s) => s.key === key)?.label || String(key || "");
}

function yearLabel(stage, year) {
  return `${year}º ${stageLabelFor(stage)}`;
}

// ── Level navigation ────────────────────────────────────────────────────────

function gruposGoTo(level, stage = null, year = null) {
  state.gruposLevel = level;
  if (stage !== null) state.gruposStage = stage;
  if (year !== null) state.gruposYear = year;
  renderGrupos();
}

function renderGrupos() {
  renderGruposBreadcrumb();

  // "Nuevo grupo" button only at level 3
  const actionsEl = document.getElementById("gruposActions");
  if (actionsEl) actionsEl.classList.toggle("hidden", state.gruposLevel !== 3);

  // Hide create form when navigating away from level 3
  if (state.gruposLevel !== 3) {
    document.getElementById("createGroupForm")?.classList.add("hidden");
    const toggleBtn = document.getElementById("toggleCreateGroupBtn");
    if (toggleBtn) toggleBtn.textContent = "+ Nuevo grupo";
  }

  if (state.gruposLevel === 1) renderLevel1();
  else if (state.gruposLevel === 2) renderLevel2();
  else renderLevel3Loading();
}

function renderGruposBreadcrumb() {
  const nav = document.getElementById("gruposBreadcrumb");
  if (!nav) return;

  if (state.gruposLevel === 1) {
    nav.classList.add("hidden");
    nav.innerHTML = "";
    return;
  }

  nav.classList.remove("hidden");
  const slabel = stageLabelFor(state.gruposStage);
  const ylabel = state.gruposYear ? yearLabel(state.gruposStage, state.gruposYear) : "";

  let html = `<button class="crumbBtn" data-crumb="1">Grupos</button>`;
  html += `<span class="crumbSep">›</span>`;

  if (state.gruposLevel === 2) {
    html += `<span class="crumbCurrent">${slabel}</span>`;
  } else {
    html += `<button class="crumbBtn" data-crumb="2">${slabel}</button>`;
    html += `<span class="crumbSep">›</span>`;
    html += `<span class="crumbCurrent">${ylabel}</span>`;
  }

  nav.innerHTML = html;
}

// ── Level 1 — Etapas ────────────────────────────────────────────────────────

function renderLevel1() {
  const container = document.getElementById("gruposLevelContainer");
  if (!container) return;

  const groups = state.adminGroups || [];
  const countByStage = {};
  for (const g of groups) {
    const k = g.stage || "__none__";
    countByStage[k] = (countByStage[k] || 0) + 1;
  }

  container.innerHTML = `<div class="stageGrid">${
    STAGES.map((s) => {
      const n = countByStage[s.key] || 0;
      return `
        <button class="stageCard" data-goto-stage="${s.key}">
          <span class="stageCardName">${s.label}</span>
          <span class="stageCardCount">${n} grupo${n !== 1 ? "s" : ""}</span>
        </button>`;
    }).join("")
  }</div>`;
}

// ── Level 2 — Cursos ────────────────────────────────────────────────────────

function renderLevel2() {
  const container = document.getElementById("gruposLevelContainer");
  if (!container) return;

  const stageDef = STAGES.find((s) => s.key === state.gruposStage);
  if (!stageDef) return;

  const groups = state.adminGroups || [];
  const stageGroups = groups.filter((g) => g.stage === state.gruposStage);
  const countByYear = {};
  for (const g of stageGroups) {
    const y = g.year || 0;
    countByYear[y] = (countByYear[y] || 0) + 1;
  }

  container.innerHTML = `<div class="yearGrid">${
    stageDef.years.map((y) => {
      const n = countByYear[y] || 0;
      return `
        <button class="yearCard" data-goto-year="${y}">
          <span class="yearCardNum">${y}º</span>
          <span class="yearCardLabel">${stageDef.label}</span>
          <span class="yearCardCount">${n} grupo${n !== 1 ? "s" : ""}</span>
        </button>`;
    }).join("")
  }</div>`;
}

// ── Level 3 — Grupos ────────────────────────────────────────────────────────

function renderLevel3Loading() {
  const container = document.getElementById("gruposLevelContainer");
  if (container) container.innerHTML = '<p class="emptyState">Cargando grupos…</p>';
  // Update create form context
  const ctx = document.getElementById("createGroupContext");
  if (ctx) ctx.textContent = `${stageLabelFor(state.gruposStage)} · ${state.gruposYear}º`;
  // Load from backend with query params
  loadGroupsForLevel3().catch(console.error);
}

const SPECIAL_KEYWORDS = /apoyo|neae|refuerzo|especial|pmar|desdoble|adaptad/i;

function isSpecialGroup(g) {
  return SPECIAL_KEYWORDS.test(g.name) || SPECIAL_KEYWORDS.test(g.track || "");
}

async function loadGroupsForLevel3() {
  const { gruposStage: stage, gruposYear: year } = state;
  const container = document.getElementById("gruposLevelContainer");

  try {
    const params = new URLSearchParams({ stage, year: String(year) });
    const url = `/api/v1/admin/groups?${params}`;
    console.log("[admin] loadGroupsForLevel3 →", url);
    const data = await fetchJSON(url);
    const loaded = toItems(data, "items");

    // Merge into full cache so level-1/2 counts stay accurate
    const byId = new Map(state.adminGroups.map((g) => [g.id, g]));
    for (const g of loaded) byId.set(g.id, g);
    state.adminGroups = [...byId.values()];

    renderGroupsLevel3List(loaded);
  } catch (err) {
    if (container) container.innerHTML = `<p class="emptyState err">No se pudieron cargar los grupos: ${escHtml(err?.message || "")}</p>`;
  }
}

function groupCardHTML(g) {
  const hint = g.join_code_hint ? `${g.join_code_hint}-????` : "Sin código";
  const trackLabel = g.track ? g.track.toUpperCase() : "";
  return `
    <article class="groupCard">
      <div class="groupCardMain">
        <div class="groupName">${escHtml(g.name)}</div>
        ${trackLabel ? `<div class="groupMeta">Grupo ${escHtml(trackLabel)}</div>` : ""}
      </div>
      <div class="groupCardCode">
        <span class="codeHint" title="Los últimos 4 dígitos solo se muestran al crear o regenerar">${escHtml(hint)}</span>
        <button class="btn ghost small" data-regen-id="${g.id}">↺ Nuevo código</button>
      </div>
      <div class="groupCardActions">
        <button class="btn primary small" data-view-students="${g.id}" data-group-name="${escHtml(g.name)}">Ver alumnos</button>
      </div>
    </article>`;
}

function renderGroupsLevel3List(groups) {
  const container = document.getElementById("gruposLevelContainer");
  if (!container) return;

  if (!groups.length) {
    container.innerHTML = '<p class="emptyState">No hay grupos en este curso. Crea el primero con el botón de arriba.</p>';
    return;
  }

  const main    = groups.filter((g) => !isSpecialGroup(g));
  const special = groups.filter((g) =>  isSpecialGroup(g));

  let html = "";

  // Main groups — always visible
  if (main.length) {
    html += `<div class="groupsList">${main.map(groupCardHTML).join("")}</div>`;
  } else {
    html += '<p class="emptyState">No hay grupos ordinarios en este curso.</p>';
  }

  // Special groups — collapsible
  if (special.length) {
    html += `
      <details class="specialGroupsBlock">
        <summary class="specialGroupsSummary">
          Grupos de apoyo y refuerzo
          <span class="specialGroupsCount">${special.length}</span>
        </summary>
        <div class="groupsList specialGroupsList">${special.map(groupCardHTML).join("")}</div>
      </details>`;
  }

  container.innerHTML = html;
}

// ── Full load (for initial cache + counts) ──────────────────────────────────

async function loadAdminGroups() {
  try {
    const data = await fetchJSON("/api/v1/admin/groups");
    state.adminGroups = toItems(data, "items");
    state.adminGroupsLoaded = true;
    renderGrupos(); // renders level 1 by default
  } catch (err) {
    const container = document.getElementById("gruposLevelContainer");
    if (container) container.innerHTML = `<p class="emptyState err">No se pudieron cargar los grupos: ${escHtml(err?.message || "")}</p>`;
  }
}

// ── Code result box ─────────────────────────────────────────────────────────

function showCodeResult(code) {
  const box = document.getElementById("codeResultBox");
  const display = document.getElementById("codeDisplay");
  if (!box || !display) return;
  display.textContent = code;
  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Create group ────────────────────────────────────────────────────────────

async function createGroup() {
  const name = String(document.getElementById("groupName")?.value || "").trim();
  const track = String(document.getElementById("groupTrack")?.value || "").trim();
  const errEl = document.getElementById("createGroupError");

  const showErr = (msg) => { if (errEl) errEl.textContent = msg; };
  if (errEl) errEl.textContent = "";
  if (!name) { showErr("El nombre del grupo es obligatorio."); return; }

  // Stage and year come from navigation state
  const body = { name, stage: state.gruposStage, year: state.gruposYear };
  if (track) body.track = track;

  const createBtn = document.getElementById("createGroupBtn");
  if (createBtn) { createBtn.disabled = true; createBtn.textContent = "Creando…"; }

  try {
    const data = await fetchJSON("/api/v1/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Reset form
    document.getElementById("createGroupForm")?.classList.add("hidden");
    document.getElementById("toggleCreateGroupBtn").textContent = "+ Nuevo grupo";
    document.getElementById("groupName").value = "";
    document.getElementById("groupTrack").value = "";
    if (errEl) errEl.textContent = "";

    // Show generated code
    if (data.join_code) showCodeResult(data.join_code);

    // Reload current level + teacher-wizard groups cache
    await loadGroupsForLevel3();
    await groupsModule?.loadGroups();
  } catch (err) {
    showErr(err?.message || "No se pudo crear el grupo.");
  } finally {
    if (createBtn) { createBtn.disabled = false; createBtn.textContent = "Crear grupo"; }
  }
}

// ── Regenerate code ─────────────────────────────────────────────────────────

async function regenerateCode(groupId) {
  try {
    const data = await fetchJSON(`/api/v1/admin/groups/${groupId}/regenerate-code`, {
      method: "POST",
    });
    if (data.join_code) showCodeResult(data.join_code);
    // Refresh current level
    await loadGroupsForLevel3();
  } catch (err) {
    const container = document.getElementById("gruposLevelContainer");
    const errDiv = document.createElement("p");
    errDiv.className = "emptyState err";
    errDiv.textContent = err?.message || "No se pudo regenerar el código.";
    container?.prepend(errDiv);
    setTimeout(() => errDiv.remove(), 5000);
  }
}

// ── ALUMNOS section ────────────────────────────────────────────────────────

function studentStatusLabel(status) {
  if (status === "pending") return "pendiente";
  if (status === "used") return "registrado";
  if (status === "revoked") return "revocado";
  return String(status || "");
}

function renderStudentsList() {
  const el = document.getElementById("studentsList");
  if (!el) return;

  const students = state.groupStudents || [];
  if (!students.length) {
    el.innerHTML = '<p class="emptyState">No hay emails autorizados para este grupo todavía.</p>';
    return;
  }

  el.innerHTML = students
    .map((s) => {
      const canRevoke = s.status === "pending" || s.status === "used";
      return `
        <div class="studentRow">
          <span class="studentEmail">${escHtml(s.email)}</span>
          <span class="statusBadge status-${s.status}">${studentStatusLabel(s.status)}</span>
          ${canRevoke
            ? `<button class="btn ghost small" data-revoke-student="${s.id}">Revocar</button>`
            : `<span></span>`}
        </div>
      `;
    })
    .join("");
}

async function loadStudents() {
  const group = state.activeGroupForStudents;
  if (!group) return;

  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";

  try {
    const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students`);
    state.groupStudents = toItems(data, "items");
    renderStudentsList();
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo cargar la lista de alumnos.";
  }
}

async function openStudentsForGroup(groupId, groupName) {
  state.activeGroupForStudents = { id: groupId, name: groupName };

  // Update accordion header subtitle
  const subtitle = document.getElementById("alumnosSubtitle");
  if (subtitle) subtitle.textContent = ` — ${groupName}`;

  // Open ALUMNOS accordion if closed
  const bodyAlumnos = document.getElementById("bodyAlumnos");
  const sectionAlumnos = document.getElementById("sectionAlumnos");
  const btn = sectionAlumnos?.querySelector(".accordionHeader");
  const caret = btn?.querySelector(".accordionCaret");
  if (bodyAlumnos?.classList.contains("hidden")) {
    bodyAlumnos.classList.remove("hidden");
    sectionAlumnos?.classList.add("isOpen");
    btn?.setAttribute("aria-expanded", "true");
    if (caret) caret.textContent = "▾";
  }

  // Show content
  document.getElementById("alumnosEmpty")?.classList.add("hidden");
  document.getElementById("alumnosContent")?.classList.remove("hidden");
  document.getElementById("alumnosGroupTitle").textContent = groupName;
  document.getElementById("addStudentEmail").value = "";
  document.getElementById("importEmailsText").value = "";
  document.getElementById("importForm")?.classList.add("hidden");
  const toggleImportBtn = document.getElementById("toggleImportBtn");
  if (toggleImportBtn) toggleImportBtn.textContent = "Importar lista";
  const alumnosErr = document.getElementById("alumnosError");
  if (alumnosErr) alumnosErr.textContent = "";

  // Scroll and load
  sectionAlumnos?.scrollIntoView({ behavior: "smooth", block: "start" });
  await loadStudents();
}

async function addStudent() {
  const email = String(document.getElementById("addStudentEmail")?.value || "").trim().toLowerCase();
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";

  if (!email || !email.includes("@")) {
    if (errEl) errEl.textContent = "Introduce un email válido.";
    return;
  }

  const group = state.activeGroupForStudents;
  if (!group) return;

  const btn = document.getElementById("addStudentBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Autorizando…"; }

  try {
    await fetchJSON(`/api/v1/admin/groups/${group.id}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    document.getElementById("addStudentEmail").value = "";
    await loadStudents();
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo autorizar el email.";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Autorizar email"; }
  }
}

async function importStudents() {
  const raw = String(document.getElementById("importEmailsText")?.value || "");
  const errEl = document.getElementById("importError");
  if (errEl) { errEl.textContent = ""; }

  // Split by newlines, commas, semicolons
  const emails = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@") && s.includes("."));

  if (!emails.length) {
    if (errEl) errEl.textContent = "No se encontraron emails válidos en el texto pegado.";
    return;
  }

  const group = state.activeGroupForStudents;
  if (!group) return;

  const btn = document.getElementById("importStudentsBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Importando…"; }

  try {
    const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });

    document.getElementById("importEmailsText").value = "";
    document.getElementById("importForm")?.classList.add("hidden");
    document.getElementById("toggleImportBtn").textContent = "Importar lista";

    const alumnosErr = document.getElementById("alumnosError");
    if (alumnosErr) alumnosErr.textContent = `✓ ${data.imported ?? emails.length} email(s) importados correctamente.`;

    await loadStudents();
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo importar la lista.";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Importar"; }
  }
}

async function revokeStudent(studentId) {
  const group = state.activeGroupForStudents;
  if (!group) return;

  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";

  try {
    await fetchJSON(`/api/v1/admin/groups/${group.id}/students/${studentId}`, {
      method: "DELETE",
    });
    await loadStudents();
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo revocar el acceso.";
  }
}

// ── CENTRO section ─────────────────────────────────────────────────────────

function renderCentro() {
  const nameEl = document.getElementById("centroName");
  const slugEl = document.getElementById("centroSlug");
  const linkEl = document.getElementById("registerLink");

  if (nameEl) nameEl.textContent = state.tenantName || "—";
  if (slugEl) slugEl.textContent = state.tenantSlug || "—";

  const registerUrl = `${window.location.origin}/student-register.html`;
  if (linkEl) linkEl.value = registerUrl;
}

function wireCentro() {
  const copyBtn = document.getElementById("copyRegisterLinkBtn");
  const linkEl = document.getElementById("registerLink");
  const feedback = document.getElementById("registerCopyFeedback");
  if (copyBtn && linkEl) {
    copyBtn.addEventListener("click", () => copyToClipboard(linkEl.value, feedback));
  }
}

// ── Accordion + lazy loading ───────────────────────────────────────────────

async function loadSection(sectionName) {
  if (sectionName === "grupos") {
    if (!state.adminGroupsLoaded) {
      await loadAdminGroups(); // also calls renderGrupos()
    } else {
      renderGrupos(); // re-render current level from cache
    }
  } else if (sectionName === "alumnos") {
    if (state.activeGroupForStudents) await loadStudents();
  } else if (sectionName === "docentes") {
    if (!state.teachersLoaded) await reloadTeachers();
  } else if (sectionName === "centro") {
    renderCentro();
  }
}

function toggleAccordion(button) {
  const targetId = button?.dataset?.accordionTarget;
  if (!targetId) return;
  const body = document.getElementById(targetId);
  const section = button.closest(".accordion");
  const caret = button.querySelector(".accordionCaret");
  if (!body || !section || !caret) return;

  const isOpen = !body.classList.contains("hidden");
  body.classList.toggle("hidden", isOpen);
  section.classList.toggle("isOpen", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
  caret.textContent = isOpen ? "▸" : "▾";

  // Lazy-load on open
  if (!isOpen) {
    const sectionName = button.dataset.section;
    if (sectionName) loadSection(sectionName).catch(console.error);
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────

function setSegmentActive(active) {
  [asTeacherBtn, asStudentBtn, logoutBtn].forEach((btn) => btn?.classList.remove("isActive"));
  if (active === "teacher") asTeacherBtn?.classList.add("isActive");
  if (active === "student") asStudentBtn?.classList.add("isActive");
}

function goTeacher() {
  setSegmentActive("teacher");
  try { localStorage.setItem("ttd_activeRole", "teacher"); } catch {}
  window.location.href = "/assets/teacher/";
}

function goStudent() {
  setSegmentActive("student");
  try { localStorage.setItem("ttd_activeRole", "student"); } catch {}
  window.location.href = "/assets/student/";
}

// ── Wire events ────────────────────────────────────────────────────────────

function wireEvents() {
  // Accordions
  document.querySelectorAll(".accordionHeader[data-accordion-target]").forEach((btn) => {
    btn.addEventListener("click", () => toggleAccordion(btn));
  });

  // Header navigation
  asTeacherBtn?.addEventListener("click", goTeacher);
  asStudentBtn?.addEventListener("click", goStudent);
  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "/index.html";
  });

  // ── GRUPOS ──────────────────────────────────────────────────────────────

  // Breadcrumb navigation
  document.getElementById("gruposBreadcrumb")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-crumb]");
    if (!btn) return;
    const level = Number(btn.dataset.crumb);
    if (level === 1) gruposGoTo(1);
    else if (level === 2) gruposGoTo(2);
  });

  // Level container: stage cards → year cards → group actions
  document.getElementById("gruposLevelContainer")?.addEventListener("click", (ev) => {
    const stageBtn = ev.target.closest("[data-goto-stage]");
    if (stageBtn) { gruposGoTo(2, stageBtn.dataset.gotoStage); return; }

    const yearBtn = ev.target.closest("[data-goto-year]");
    if (yearBtn) { gruposGoTo(3, null, Number(yearBtn.dataset.gotoYear)); return; }

    const regenBtn = ev.target.closest("[data-regen-id]");
    if (regenBtn) { regenerateCode(regenBtn.dataset.regenId).catch(console.error); return; }

    const viewBtn = ev.target.closest("[data-view-students]");
    if (viewBtn) {
      openStudentsForGroup(viewBtn.dataset.viewStudents, viewBtn.dataset.groupName || "Grupo")
        .catch(console.error);
    }
  });

  // Create form toggle (level 3)
  document.getElementById("toggleCreateGroupBtn")?.addEventListener("click", () => {
    const form = document.getElementById("createGroupForm");
    const btn = document.getElementById("toggleCreateGroupBtn");
    const isHidden = form?.classList.contains("hidden");
    form?.classList.toggle("hidden", !isHidden);
    if (btn) btn.textContent = isHidden ? "✕ Cancelar" : "+ Nuevo grupo";
    if (isHidden) document.getElementById("groupName")?.focus();
  });

  document.getElementById("cancelCreateGroupBtn")?.addEventListener("click", () => {
    document.getElementById("createGroupForm")?.classList.add("hidden");
    document.getElementById("toggleCreateGroupBtn").textContent = "+ Nuevo grupo";
    document.getElementById("createGroupError").textContent = "";
  });

  document.getElementById("createGroupBtn")?.addEventListener("click", () => {
    createGroup().catch((err) => {
      const errEl = document.getElementById("createGroupError");
      if (errEl) errEl.textContent = err?.message || "No se pudo crear el grupo.";
    });
  });

  document.getElementById("groupName")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createGroup().catch(() => {});
  });

  document.getElementById("closeCodeResultBtn")?.addEventListener("click", () => {
    document.getElementById("codeResultBox")?.classList.add("hidden");
  });

  document.getElementById("copyCodeBtn")?.addEventListener("click", () => {
    const code = document.getElementById("codeDisplay")?.textContent || "";
    const feedback = document.getElementById("codeCopyFeedback");
    copyToClipboard(code, feedback);
  });

  // ── ALUMNOS ──────────────────────────────────────────────────────────────

  document.getElementById("alumnosBackBtn")?.addEventListener("click", () => {
    state.activeGroupForStudents = null;
    document.getElementById("alumnosContent")?.classList.add("hidden");
    document.getElementById("alumnosEmpty")?.classList.remove("hidden");
    const subtitle = document.getElementById("alumnosSubtitle");
    if (subtitle) subtitle.textContent = "";
  });

  document.getElementById("addStudentBtn")?.addEventListener("click", () => {
    addStudent().catch(console.error);
  });

  document.getElementById("addStudentEmail")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addStudent().catch(console.error);
  });

  document.getElementById("toggleImportBtn")?.addEventListener("click", () => {
    const form = document.getElementById("importForm");
    const btn = document.getElementById("toggleImportBtn");
    const isHidden = form?.classList.contains("hidden");
    form?.classList.toggle("hidden", !isHidden);
    if (btn) btn.textContent = isHidden ? "✕ Cancelar importación" : "Importar lista";
    if (isHidden) document.getElementById("importEmailsText")?.focus();
  });

  document.getElementById("cancelImportBtn")?.addEventListener("click", () => {
    document.getElementById("importForm")?.classList.add("hidden");
    document.getElementById("toggleImportBtn").textContent = "Importar lista";
    document.getElementById("importError").textContent = "";
  });

  document.getElementById("importStudentsBtn")?.addEventListener("click", () => {
    importStudents().catch(console.error);
  });

  // Delegation for students list (revoke)
  document.getElementById("studentsList")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-revoke-student]");
    if (btn) revokeStudent(btn.dataset.revokeStudent).catch(console.error);
  });

  // ── DOCENTES – wizard ────────────────────────────────────────────────────

  inviteStartBtn?.addEventListener("click", () => {
    setError("");
    const email = normalizeLabel(teacherEmail?.value);
    const displayName = normalizeLabel(teacherDisplayName?.value);
    if (!email) return setError("Introduce el email del docente.");
    if (!displayName) return setError("Introduce el nombre del docente.");
    showInviteStep("subjects");
  });

  toGroupsBtn?.addEventListener("click", () => {
    setError("");
    if (!selectedSubjects.size) return setError("Añade al menos una materia.");
    showInviteStep("groups");
  });

  toTutorBtn?.addEventListener("click", () => {
    setError("");
    if (!state.selectedGroupIds.size) return setError("Selecciona al menos un grupo.");
    showInviteStep("tutor");
  });

  createTeacherInviteBtn?.addEventListener("click", () => {
    createInvite().catch((err) => setError(err?.message || "No se pudo crear la invitación."));
  });

  subjectAddBtn?.addEventListener("click", addCustomSubject);
  teacherEmail?.addEventListener("input", refreshInviteButtons);
  teacherDisplayName?.addEventListener("input", refreshInviteButtons);
  groupsEls.tutorGroupSelect?.addEventListener("change", () => {
    renderInviteSummary();
    refreshInviteButtons();
  });
  subjectSelect?.addEventListener("change", () => {
    const val = normalizeLabel(subjectSelect.value);
    if (!val || val === SUBJECT_PLACEHOLDER) return;
    if (val === SUBJECT_OTHER) {
      refreshSubjectAddVisibility();
      subjectAddInput?.focus();
      return;
    }
    addSubject(val);
    subjectSelect.value = SUBJECT_PLACEHOLDER;
    refreshSubjectAddVisibility();
  });

  subjectAddInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); addCustomSubject(); }
  });

  // Delegation for teachers list (revoke invite)
  teachersList?.addEventListener("click", (ev) => {
    const button = ev.target.closest("button[data-revoke-id]");
    if (!button) return;
    revokeInvite(button.dataset.revokeId).catch((err) => setError(err?.message || "No se pudo revocar."));
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const token = getAccessToken();
  if (!token) {
    window.location.href = "/index.html";
    return;
  }

  const me = await fetchJSON("/api/v1/me");
  state.me = me;
  state.memberships = Array.isArray(me?.memberships) ? me.memberships : [];

  const activeMemberships = state.memberships.filter(isActiveMembership);
  if (!activeMemberships.length) {
    window.location.href = "/index.html";
    return;
  }

  let tenantSlug = normalizeLabel(getTenantSlug());
  if (!tenantSlug) {
    tenantSlug = tenantSlugOf(activeMemberships[0]) || "";
    if (tenantSlug) setActiveTenantSlug(tenantSlug);
  }

  let scoped = activeMemberships.filter((m) => tenantSlugOf(m) === tenantSlug);
  if (!scoped.length) {
    scoped = activeMemberships;
    tenantSlug = tenantSlugOf(scoped[0]) || tenantSlug;
    if (tenantSlug) setActiveTenantSlug(tenantSlug);
  }

  state.tenantSlug = tenantSlug;
  state.tenantName = tenantNameOf(scoped[0]) || tenantSlug;

  const flags = roleFlags();
  if (!flags.hasAdmin) {
    if (flags.hasTeacher) return goTeacher();
    if (flags.hasStudent) return goStudent();
    window.location.href = "/index.html";
    return;
  }

  if (tenantEl) tenantEl.textContent = state.tenantName || "—";

  groupsModule = initAdminGroups({
    apiFetch: fetchJSON,
    els: groupsEls,
    state,
    opts: {
      onSelectionChange: () => {
        renderInviteSummary();
        refreshInviteButtons();
      },
    },
  });

  wireEvents();
  wireInviteResult();
  wireCentro();

  // Init wizard state
  showInviteStep("basics");
  renderSubjectSelect();
  renderSubjectChips();
  renderInviteSummary();
  refreshSubjectAddVisibility();
  refreshInviteButtons();

  // Load GRUPOS section (open by default)
  await loadAdminGroups();
}

init().catch((err) => {
  if (errorEl) errorEl.textContent = err?.message || "No se pudo cargar la zona admin.";
});
