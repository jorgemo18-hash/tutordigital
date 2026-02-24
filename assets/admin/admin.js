import {
  apiFetch,
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
} from "../shared/js/auth.js";
import { initAdminGroups } from "./modules/admin-groups.js";

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

const tenantEl = document.getElementById("adminTenant");
const errorEl = document.getElementById("adminError");
const resultEl = document.getElementById("adminInviteResult");

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
const trackPills = document.getElementById("trackPills");
const groupGrid = document.getElementById("groupGrid");
const groupsHint = document.getElementById("groupsHint");
const groupChips = document.getElementById("groupChips");
const tutorGroupSelect = document.getElementById("tutorGroupSelect");
const groupsEls = {
  stageSelect,
  yearSelect,
  trackSelect,
  customTrackWrap,
  customTrackInput,
  trackPills,
  groupGrid,
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
};

const selectedSubjects = new Set();
let groupsModule = null;
const SUBJECT_PLACEHOLDER = "__placeholder__";
const SUBJECT_OTHER = "__OTHER__";

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

async function reloadData() {
  setError("");
  setResult("");

  const teachersRes = await fetchJSON("/api/v1/admin/teachers");
  state.teachers = toItems(teachersRes, "teachers");
  if (groupsModule) {
    await groupsModule.loadGroups();
  }
  state.groups = state.allGroups;

  if (!state.groups.length) {
    setError("No hay grupos creados en este centro. Crea grupos en admin/BD para poder asignar docentes.");
  }

  renderSubjectSelect();
  renderSubjectChips();
  renderTeachers();
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
    teachersList.innerHTML = '<p class="teacherMeta">No hay docentes creados todavía.</p>';
    return;
  }

  teachersList.innerHTML = items
    .map((item) => {
      const subjects = item.subjects?.length
        ? item.subjects.map((s) => `<span class="chip">${s}</span>`).join("")
        : '<span class="teacherMeta">Sin materias</span>';
      const groups = item.groups?.length
        ? item.groups.map((g) => `<span class="chip">${g.name}${g.is_tutor ? " (tutoría)" : ""}</span>`).join("")
        : '<span class="teacherMeta">Sin grupos</span>';
      const invite = item.invite || null;
      const inviteLabel = inviteStatusLabel(invite?.status);

      return `
        <article class="teacherCard">
          <div class="teacherTop">
            <div>
              <div class="teacherName">${item.display_name || "Docente"}</div>
              <div class="teacherMeta">${item.email || ""}</div>
            </div>
            <div class="teacherMeta">Invitación: ${inviteLabel}</div>
          </div>
          <div class="chips">${subjects}</div>
          <div class="chips">${groups}</div>
          <div class="row">
            ${invite?.status === "pending" ? `<button class="btn ghost" data-revoke-id="${invite.id}">Revocar</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
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
  const code = invite.code || "";
  setResult(`Invitación creada para ${invite.email || email}.\nCódigo: ${code || "(sin código)"}`);

  try {
    if (code && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
    }
  } catch {}

  teacherEmail.value = "";
  teacherDisplayName.value = "";
  selectedSubjects.clear();
  state.selectedGroupIds.clear();
  if (groupsEls.tutorGroupSelect) groupsEls.tutorGroupSelect.value = "";
  showInviteStep("basics");
  groupsModule?.renderGroupsUI();
  groupsModule?.renderTutorOptions();
  renderInviteSummary();
  refreshInviteButtons();
  await reloadData();
}

async function revokeInvite(inviteId) {
  setError("");
  await fetchJSON(`/api/v1/admin/teachers/teacher-invites/${inviteId}/revoke`, {
    method: "POST",
  });
  await reloadData();
}

function setSegmentActive(active) {
  [asTeacherBtn, asStudentBtn, logoutBtn].forEach((btn) => btn?.classList.remove("isActive"));
  if (active === "teacher") asTeacherBtn?.classList.add("isActive");
  if (active === "student") asStudentBtn?.classList.add("isActive");
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
}

function goTeacher() {
  setSegmentActive("teacher");
  try {
    localStorage.setItem("ttd_activeRole", "teacher");
  } catch {}
  window.location.href = "/assets/teacher/";
}

function goStudent() {
  setSegmentActive("student");
  try {
    localStorage.setItem("ttd_activeRole", "student");
  } catch {}
  window.location.href = "/assets/student/";
}

function wireEvents() {
  document.querySelectorAll(".accordionHeader[data-accordion-target]").forEach((btn) => {
    btn.addEventListener("click", () => toggleAccordion(btn));
  });

  asTeacherBtn?.addEventListener("click", goTeacher);
  asStudentBtn?.addEventListener("click", goStudent);

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "/index.html";
  });

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
    if (ev.key === "Enter") {
      ev.preventDefault();
      addCustomSubject();
    }
  });

  teachersList?.addEventListener("click", (ev) => {
    const button = ev.target.closest("button[data-revoke-id]");
    if (!button) return;
    const inviteId = button.dataset.revokeId;
    revokeInvite(inviteId).catch((err) => setError(err?.message || "No se pudo revocar."));
  });
}

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
  showInviteStep("basics");
  renderSubjectSelect();
  renderSubjectChips();
  renderInviteSummary();
  refreshSubjectAddVisibility();
  refreshInviteButtons();
  await reloadData();
}

init().catch((err) => {
  setError(err?.message || "No se pudo cargar la zona admin.");
});
