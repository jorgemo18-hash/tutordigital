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

const subjectSelect = document.getElementById("subjectSelect");
const subjectAddInput = document.getElementById("subjectAddInput");
const subjectAddBtn = document.getElementById("subjectAddBtn");
const subjectChips = document.getElementById("subjectChips");

const stageSelect = document.getElementById("stageSelect");
const yearSelect = document.getElementById("yearSelect");
const trackPills = document.getElementById("trackPills");
const groupGrid = document.getElementById("groupGrid");
const groupsHint = document.getElementById("groupsHint");
const groupChips = document.getElementById("groupChips");
const tutorGroupSelect = document.getElementById("tutorGroupSelect");

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
const selectedGroupMetaById = new Map();
let allGroups = [];
const creatingGroupKeys = new Set();

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

function stageYears(stage) {
  if (stage === "primaria") return [1, 2, 3, 4, 5, 6];
  if (stage === "eso") return [1, 2, 3, 4];
  return [1, 2];
}

function stageLabel(stage) {
  if (stage === "primaria") return "Primaria";
  if (stage === "eso") return "ESO";
  return "Bachillerato";
}

function normalizeStage(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("prim")) return "primaria";
  if (raw.includes("eso") || raw.includes("secund")) return "eso";
  if (raw.includes("bach")) return "bachiller";
  return "";
}

function parseStageFromName(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("primaria")) return "primaria";
  if (text.includes("eso") || text.includes("secund")) return "eso";
  if (text.includes("bach")) return "bachiller";
  return "";
}

function parseYear(value, fallbackText = "") {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 6) return n;
  const hit = String(fallbackText || "").match(/\b([1-6])\s*(?:º|o|°)?\b/i);
  return hit ? Number(hit[1]) : null;
}

function normalizeGroup(raw) {
  const id = String(raw?.id || raw?.slug || "").trim();
  if (!id) return null;

  const name = String(raw?.name || raw?.label || raw?.title || raw?.slug || id).trim();
  const stage = normalizeStage(raw?.stage || raw?.level || raw?.grade_stage || parseStageFromName(name));
  const year = parseYear(raw?.year || raw?.grade || raw?.course || raw?.grade_year, name);
  const displayLabel = name;
  return { id, name, stage, year, displayLabel };
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
  ph.value = "__placeholder__";
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

  subjectSelect.value = "__placeholder__";
}

function renderSubjectChips() {
  const items = [...selectedSubjects]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((subject) => ({ key: subject, label: subject }));

  renderChips(subjectChips, items, (subject) => {
    selectedSubjects.delete(subject);
    renderSubjectChips();
  });
}

function addSubject(subject) {
  const selected = normalizeLabel(subject);
  if (!selected || selected === "__placeholder__") return;
  selectedSubjects.add(selected);
  renderSubjectChips();
}

function addCustomSubject() {
  const value = normalizeLabel(subjectAddInput?.value);
  if (!value) return;
  state.customSubjects = uniq([...state.customSubjects, value]);
  addSubject(value);
  subjectAddInput.value = "";
  renderSubjectSelect();
}

function renderYearSelect() {
  if (!yearSelect) return;
  const years = stageYears(stageSelect?.value || "primaria");
  const prev = Number(yearSelect.value || years[0]);

  yearSelect.innerHTML = "";
  years.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = `${year}º`;
    yearSelect.appendChild(opt);
  });

  yearSelect.value = String(years.includes(prev) ? prev : years[0]);
}

function groupId(g) {
  return g?.id || g?.slug || g?.group_id || g?.groupId || null;
}

function groupDisplay(g) {
  return g?.displayLabel || g?.display || g?.name || g?.label || g?.title || g?.slug || g?.id || "Grupo";
}

function ensureStageValue(stage = "") {
  const raw = String(stage || "").toLowerCase();
  if (raw === "bach") return "bachiller";
  return raw;
}

async function ensureGroup(stage, year, track) {
  return fetchJSON("/api/v1/admin/groups/ensure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stage: ensureStageValue(stage),
      year: Number(year),
      track: String(track || "").toUpperCase(),
    }),
  });
}

function inferTrack(g) {
  const direct = String(g?.track || "").toUpperCase();
  if (["A", "B", "C", "D", "E"].includes(direct)) return direct;
  const hit = String(groupDisplay(g)).toUpperCase().match(/\b([A-E])\b/);
  return hit ? hit[1] : "";
}

function findGroupByStageYearTrack(stage, year, track) {
  return allGroups.find((g) => {
    const sameStage = g.stage === stage;
    const sameYear = Number(g.year) === Number(year);
    const sameTrack = inferTrack(g) === String(track || "").toUpperCase();
    return sameStage && sameYear && sameTrack;
  }) || null;
}

function setGroupMeta(id, label) {
  selectedGroupMetaById.set(String(id), { label: String(label || `Grupo ${id}`) });
}

function groupLabelFromSelection(id) {
  const key = String(id);
  if (selectedGroupMetaById.has(key)) return selectedGroupMetaById.get(key).label;
  const fromCache = allGroups.find((g) => String(g.id) === key);
  return fromCache ? groupDisplay(fromCache) : `Grupo ${key}`;
}

function renderTrackPills(stage, year) {
  if (!trackPills) return;
  trackPills.innerHTML = "";
  const letters = ["A", "B", "C", "D", "E"];

  letters.forEach((track) => {
    const key = `${stage}|${year}|${track}`;
    const existing = findGroupByStageYearTrack(stage, year, track);
    const existingId = existing ? String(groupId(existing)) : "";
    const isSelected = existingId && selectedGroupIds.has(existingId);

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `trackPill${isSelected ? " isSelected" : ""}`;
    pill.textContent = track;

    if (creatingGroupKeys.has(key)) {
      pill.classList.add("isLoading");
      pill.disabled = true;
    }

    pill.addEventListener("click", async () => {
      setError("");
      let resolved = existing;
      let resolvedId = existingId;

      if (!resolvedId) {
        if (creatingGroupKeys.has(key)) return;
        creatingGroupKeys.add(key);
        pill.classList.add("isLoading");
        try {
          const created = await ensureGroup(stage, year, track);
          const norm = normalizeGroup(created);
          resolved = norm;
          resolvedId = norm?.id ? String(norm.id) : "";
          if (!resolvedId) throw new Error("No se pudo crear/encontrar el grupo en backend.");
          const idx = allGroups.findIndex((g) => String(g.id) === resolvedId);
          if (idx >= 0) allGroups[idx] = norm;
          else allGroups.push(norm);
        } catch (err) {
          setError(err?.message || "No se pudo crear/encontrar el grupo en backend.");
          creatingGroupKeys.delete(key);
          refreshGroupsUI();
          return;
        }
        creatingGroupKeys.delete(key);
      }

      if (selectedGroupIds.has(resolvedId)) {
        selectedGroupIds.delete(resolvedId);
        selectedGroupMetaById.delete(resolvedId);
        if (String(tutorGroupSelect?.value || "") === resolvedId) tutorGroupSelect.value = "";
      } else {
        selectedGroupIds.add(resolvedId);
        setGroupMeta(resolvedId, `${year}º ${stageLabel(stage)} ${track}`);
      }
      refreshGroupsUI();
    });

    trackPills.appendChild(pill);
  });
}

function renderPrimaryGrid(stage, year) {
  if (!groupGrid) return;
  groupGrid.innerHTML = "";
  const filtered = allGroups.filter((g) => g.stage === stage && Number(g.year) === Number(year));

  if (!filtered.length) {
    groupsHint.textContent = "No hay grupos creados para este curso.";
    return;
  }

  groupsHint.textContent = `Selecciona grupos para ${year}º ${stageLabel(stage)}.`;

  filtered.forEach((g) => {
    const id = String(g.id);
    const isSelected = selectedGroupIds.has(id);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `groupBtn${isSelected ? " isSelected" : ""}`;
    btn.textContent = groupDisplay(g);

    btn.addEventListener("click", () => {
      if (selectedGroupIds.has(id)) {
        selectedGroupIds.delete(id);
        selectedGroupMetaById.delete(id);
        if (String(tutorGroupSelect?.value || "") === id) tutorGroupSelect.value = "";
      } else {
        selectedGroupIds.add(id);
        setGroupMeta(id, groupDisplay(g));
      }
      refreshGroupsUI();
    });

    groupGrid.appendChild(btn);
  });
}

function renderGroupChips() {
  const items = [...selectedGroupIds]
    .map((id) => ({ key: String(id), label: groupLabelFromSelection(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  renderChips(groupChips, items, (id) => {
    const key = String(id);
    selectedGroupIds.delete(key);
    selectedGroupMetaById.delete(key);
    if (String(tutorGroupSelect?.value || "") === key) tutorGroupSelect.value = "";
    refreshGroupsUI();
  });
}

function renderTutorOptions() {
  if (!tutorGroupSelect) return;
  const current = String(tutorGroupSelect.value || "");
  tutorGroupSelect.innerHTML = '<option value="">Sin tutoría</option>';

  [...selectedGroupIds]
    .map((id) => String(id))
    .sort((a, b) => groupLabelFromSelection(a).localeCompare(groupLabelFromSelection(b), "es"))
    .forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = groupLabelFromSelection(id);
      tutorGroupSelect.appendChild(opt);
    });

  tutorGroupSelect.value = current && selectedGroupIds.has(current) ? current : "";
}

function refreshGroupsUI() {
  const stage = String(stageSelect?.value || "primaria");
  const year = Number(yearSelect?.value || 1);

  renderGroupChips();
  renderTutorOptions();

  if (stage === "eso" || stage === "bachiller") {
    if (trackPills) trackPills.style.display = "flex";
    if (groupGrid) groupGrid.style.display = "none";
    groupsHint.textContent = `Marca letras para ${year}º ${stageLabel(stage)}. Se acumulan aunque cambies de curso.`;
    renderTrackPills(stage, year);
    return;
  }

  if (trackPills) {
    trackPills.style.display = "none";
    trackPills.innerHTML = "";
  }
  if (groupGrid) groupGrid.style.display = "grid";
  renderPrimaryGrid(stage, year);
}

async function reloadData() {
  setError("");
  setResult("");

  const groupsRes = await fetchJSON("/api/v1/groups?limit=500&offset=0");
  const rawGroups = toItems(groupsRes, "groups");
  allGroups = rawGroups.map(normalizeGroup).filter(Boolean);
  state.groups = allGroups;
  const validIds = new Set(allGroups.map((g) => g.id));
  [...selectedGroupIds].forEach((id) => {
    const key = String(id);
    if (!validIds.has(key)) {
      selectedGroupIds.delete(key);
      selectedGroupMetaById.delete(key);
      return;
    }
    if (!selectedGroupMetaById.has(key)) {
      const found = allGroups.find((g) => g.id === key);
      if (found) setGroupMeta(key, groupDisplay(found));
    }
  });

  const teachersRes = await fetchJSON("/api/v1/admin/teachers");
  state.teachers = toItems(teachersRes, "teachers");

  if (!state.groups.length) {
    setError("No hay grupos creados en este centro. Crea grupos en admin/BD para poder asignar docentes.");
  }

  renderSubjectSelect();
  renderSubjectChips();
  renderYearSelect();
  refreshGroupsUI();
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
  const groupIds = [...selectedGroupIds];
  const tutorGroupId = normalizeLabel(tutorGroupSelect?.value) || null;

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
  selectedGroupIds.clear();
  renderTutorOptions();
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

  adminReloadBtn?.addEventListener("click", () => {
    reloadData().catch((err) => setError(err?.message || "No se pudo recargar."));
  });

  createTeacherInviteBtn?.addEventListener("click", () => {
    createInvite().catch((err) => setError(err?.message || "No se pudo crear la invitación."));
  });

  subjectAddBtn?.addEventListener("click", addCustomSubject);
  subjectSelect?.addEventListener("change", () => {
    const val = normalizeLabel(subjectSelect.value);
    if (!val || val === "__placeholder__") return;
    addSubject(val);
    subjectSelect.value = "__placeholder__";
  });

  subjectAddInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addCustomSubject();
    }
  });

  stageSelect?.addEventListener("change", () => {
    renderYearSelect();
    refreshGroupsUI();
  });

  yearSelect?.addEventListener("change", () => {
    refreshGroupsUI();
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
  renderSubjectSelect();
  renderSubjectChips();
  renderYearSelect();
  await reloadData();
}

init().catch((err) => {
  setError(err?.message || "No se pudo cargar la zona admin.");
});
