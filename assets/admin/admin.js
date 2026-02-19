import {
  apiFetch,
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
} from "../shared/js/auth.js";

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

const subjectPickList = document.getElementById("subjectPickList");
const subjectChips = document.getElementById("subjectChips");
const subjectAddInput = document.getElementById("subjectAddInput");
const subjectAddBtn = document.getElementById("subjectAddBtn");

const stageSelect = document.getElementById("stageSelect");
const yearSelect = document.getElementById("yearSelect");
const groupGrid = document.getElementById("groupGrid");
const groupChips = document.getElementById("groupChips");
const tutorGroupSelect = document.getElementById("tutorGroupSelect");
const trackListInput = document.getElementById("trackListInput");
const generateGroupsBtn = document.getElementById("generateGroupsBtn");

const createTeacherInviteBtn = document.getElementById("createTeacherInviteBtn");
const adminReloadBtn = document.getElementById("adminReloadBtn");
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
};

const selectedSubjects = new Set();
const selectedGroupIds = new Set();
const groupIdToLabel = new Map();

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

function stageYears(stage) {
  if (stage === "primaria") return [1, 2, 3, 4, 5, 6];
  if (stage === "eso") return [1, 2, 3, 4];
  return [1, 2];
}

function groupDisplay(g) {
  return String(g?.name || g?.label || g?.title || g?.id || "Grupo");
}

function groupMatches(g, stage, year) {
  const name = groupDisplay(g).toLowerCase();
  const stageOk =
    stage === "primaria"
      ? name.includes("primaria")
      : stage === "eso"
      ? name.includes("eso") || name.includes("secund")
      : name.includes("bach") || name.includes("bachiller");

  const y = String(year || "");
  const yearOk = !y || name.includes(`${y}º`) || name.includes(`${y} `) || name.includes(`${y}o`);
  return stageOk && yearOk;
}

function renderChips(containerEl, labels = [], onRemove) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  labels.forEach((label) => {
    const chip = document.createElement("div");
    chip.className = "chip";

    const span = document.createElement("span");
    span.textContent = label;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "×";
    btn.addEventListener("click", () => onRemove(label));

    chip.append(span, btn);
    containerEl.appendChild(chip);
  });
}

function renderSubjectsList() {
  if (!subjectPickList) return;
  const fromTeachers = (state.teachers || []).flatMap((t) => t.subjects || []);
  const all = uniq([...DEFAULT_SUBJECTS, ...state.customSubjects, ...fromTeachers]).sort((a, b) => a.localeCompare(b, "es"));

  subjectPickList.innerHTML = "";
  all.forEach((subject) => {
    const item = document.createElement("div");
    item.className = `pickItem${selectedSubjects.has(subject) ? " isSelected" : ""}`;

    const label = document.createElement("span");
    label.textContent = subject;

    const check = document.createElement("span");
    check.className = "pickTick";
    check.textContent = "✓";

    item.append(label, check);
    item.addEventListener("click", () => {
      if (selectedSubjects.has(subject)) selectedSubjects.delete(subject);
      else selectedSubjects.add(subject);
      renderSubjectsList();
      renderSubjectChips();
    });
    subjectPickList.appendChild(item);
  });
}

function renderSubjectChips() {
  const labels = [...selectedSubjects].sort((a, b) => a.localeCompare(b, "es"));
  renderChips(subjectChips, labels, (label) => {
    selectedSubjects.delete(label);
    renderSubjectsList();
    renderSubjectChips();
  });
}

function renderYearSelect() {
  if (!yearSelect) return;
  const years = stageYears(stageSelect?.value || "primaria");
  const prev = String(yearSelect.value || "");
  yearSelect.innerHTML = "";
  years.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = `${year}º`;
    yearSelect.appendChild(opt);
  });
  if (prev && years.includes(Number(prev))) yearSelect.value = prev;
}

function renderGroupGrid() {
  if (!groupGrid) return;
  groupGrid.innerHTML = "";

  const stage = stageSelect?.value || "primaria";
  const year = yearSelect?.value || "";
  const filtered = (state.groups || []).filter((g) => groupMatches(g, stage, year));

  filtered.forEach((group) => {
    const key = String(group?.id || group?.slug || groupDisplay(group));
    const label = groupDisplay(group);
    groupIdToLabel.set(key, label);

    const btn = document.createElement("div");
    btn.className = `groupBtn${selectedGroupIds.has(key) ? " isSelected" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (selectedGroupIds.has(key)) selectedGroupIds.delete(key);
      else selectedGroupIds.add(key);
      renderGroupGrid();
      renderGroupChips();
      syncTutorSelectFromSelectedGroups();
    });

    groupGrid.appendChild(btn);
  });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "teacherMeta";
    empty.textContent = "No hay grupos para ese filtro.";
    groupGrid.appendChild(empty);
  }
}

function renderGroupChips() {
  if (!groupChips) return;
  groupChips.innerHTML = "";
  const ids = [...selectedGroupIds].sort((a, b) => {
    const la = groupIdToLabel.get(a) || a;
    const lb = groupIdToLabel.get(b) || b;
    return la.localeCompare(lb, "es");
  });
  ids.forEach((id) => {
    const chip = document.createElement("div");
    chip.className = "chip";

    const span = document.createElement("span");
    span.textContent = groupIdToLabel.get(id) || id;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      selectedGroupIds.delete(id);
      renderGroupGrid();
      renderGroupChips();
      syncTutorSelectFromSelectedGroups();
    });

    chip.append(span, btn);
    groupChips.appendChild(chip);
  });
}

function syncTutorSelectFromSelectedGroups() {
  if (!tutorGroupSelect) return;
  const current = String(tutorGroupSelect.value || "");
  tutorGroupSelect.innerHTML = '<option value="">Sin tutoría</option>';

  [...selectedGroupIds].forEach((groupId) => {
    const opt = document.createElement("option");
    opt.value = groupId;
    opt.textContent = groupIdToLabel.get(groupId) || groupId;
    tutorGroupSelect.appendChild(opt);
  });

  if (current && selectedGroupIds.has(current)) {
    tutorGroupSelect.value = current;
  }
}

function parseTracks() {
  const raw = normalizeLabel(trackListInput?.value);
  const list = raw
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  return list.length ? uniq(list) : ["A", "B", "C", "D", "E"];
}

function setSegmentActive(active) {
  [asTeacherBtn, asStudentBtn, logoutBtn].forEach((btn) => btn?.classList.remove("isActive"));
  if (active === "teacher") asTeacherBtn?.classList.add("isActive");
  if (active === "student") asStudentBtn?.classList.add("isActive");
}

function toItems(payload, fallbackKey) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (fallbackKey && Array.isArray(payload?.[fallbackKey])) return payload[fallbackKey];
  return [];
}

async function reloadData() {
  setError("");
  setResult("");
  state.groups = toItems(await fetchJSON("/api/v1/groups?limit=500&offset=0"), "groups");
  groupIdToLabel.clear();
  state.groups.forEach((g) => {
    const key = String(g?.id || g?.slug || groupDisplay(g));
    groupIdToLabel.set(key, groupDisplay(g));
  });
  state.teachers = toItems(await fetchJSON("/api/v1/admin/teachers"), "teachers");

  if (!state.groups.length) {
    setError("No hay grupos cargados. Pulsa 'Generar grupos estándar'.");
  }

  renderSubjectsList();
  renderSubjectChips();
  renderYearSelect();
  renderGroupGrid();
  renderGroupChips();
  syncTutorSelectFromSelectedGroups();
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

async function generateGroups() {
  setError("");
  setResult("");
  const tracks = parseTracks();
  const data = await fetchJSON("/api/v1/admin/teachers/groups/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tracks }),
  });

  setResult(`Grupos estándar generados/actualizados.\nCreados: ${data?.created || 0}\nTotal: ${data?.total || 0}\nVías: ${(data?.tracks || tracks).join(", ")}`);
  await reloadData();
}

async function createInvite() {
  setError("");
  setResult("");

  const email = normalizeLabel(teacherEmail?.value);
  const displayName = normalizeLabel(teacherDisplayName?.value);
  const subjects = [...selectedSubjects];
  const groupIds = [...selectedGroupIds];
  const tutorGroupId = normalizeLabel(tutorGroupSelect?.value) || null;

  if (!email) {
    setError("Introduce el email del docente.");
    return;
  }
  if (!displayName) {
    setError("Introduce el nombre del docente.");
    return;
  }
  if (!subjects.length) {
    setError("Selecciona al menos una materia.");
    return;
  }
  if (!groupIds.length) {
    setError("Selecciona al menos un grupo.");
    return;
  }

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
  selectedGroupIds.clear();
  syncTutorSelectFromSelectedGroups();
  await reloadData();
}

async function revokeInvite(inviteId) {
  setError("");
  await fetchJSON(`/api/v1/admin/teachers/teacher-invites/${inviteId}/revoke`, {
    method: "POST",
  });
  await reloadData();
}

function addCustomSubject() {
  const value = normalizeLabel(subjectAddInput?.value);
  if (!value) return;
  state.customSubjects = uniq([...state.customSubjects, value]);
  selectedSubjects.add(value);
  subjectAddInput.value = "";
  renderSubjectsList();
  renderSubjectChips();
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

function wireEvents() {
  asTeacherBtn?.addEventListener("click", goTeacher);
  asStudentBtn?.addEventListener("click", goStudent);

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "/index.html";
  });

  adminReloadBtn?.addEventListener("click", () => {
    reloadData().catch((err) => setError(err?.message || "No se pudo recargar."));
  });

  createTeacherInviteBtn?.addEventListener("click", () => {
    createInvite().catch((err) => setError(err?.message || "No se pudo crear la invitación."));
  });

  generateGroupsBtn?.addEventListener("click", () => {
    generateGroups().catch((err) => setError(err?.message || "No se pudieron generar grupos."));
  });

  subjectAddBtn?.addEventListener("click", addCustomSubject);
  subjectAddInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addCustomSubject();
    }
  });

  stageSelect?.addEventListener("change", () => {
    renderYearSelect();
    renderGroupGrid();
  });

  yearSelect?.addEventListener("change", () => {
    renderGroupGrid();
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

  wireEvents();
  renderSubjectsList();
  renderSubjectChips();
  renderYearSelect();
  await reloadData();
}

init().catch((err) => {
  setError(err?.message || "No se pudo cargar la zona admin.");
});
