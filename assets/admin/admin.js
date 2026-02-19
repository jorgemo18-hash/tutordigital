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
const teacherSubjects = document.getElementById("teacherSubjects");
const newSubjectInput = document.getElementById("newSubjectInput");
const addSubjectBtn = document.getElementById("addSubjectBtn");

const teacherGroupIds = document.getElementById("teacherGroupIds");
const teacherTutorGroupId = document.getElementById("teacherTutorGroupId");
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

function goTeacher() {
  try { localStorage.setItem("ttd_activeRole", "teacher"); } catch {}
  window.location.href = "/assets/teacher/";
}

function goStudent() {
  try { localStorage.setItem("ttd_activeRole", "student"); } catch {}
  window.location.href = "/assets/student/";
}

function mapApiError(status, body, fallback) {
  const code = String(body?.error?.code || "").toLowerCase();
  if (code === "forbidden_origin") return "Origen no permitido por seguridad.";
  if (code === "rate_limited") return "Demasiadas peticiones. Espera unos segundos.";
  if (code === "tenant_forbidden" || code === "forbidden_tenant") return "No tienes acceso a este centro.";
  if (code === "role_forbidden") return "Solo un admin puede hacer esta acción.";
  if (code === "invalid_group_ids") return "Hay grupos seleccionados que no pertenecen al centro.";
  if (code === "invalid_tutor_group") return "La tutoría debe ser uno de los grupos seleccionados.";
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

function uniq(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((v) => String(v).trim())));
}

function selectedValues(selectEl) {
  const values = [];
  const options = selectEl?.options || [];
  for (let i = 0; i < options.length; i += 1) {
    if (options[i].selected) values.push(options[i].value);
  }
  return values;
}

function selectedSubjects() {
  return selectedValues(teacherSubjects);
}

function selectedGroupIds() {
  return selectedValues(teacherGroupIds);
}

function renderSubjects() {
  if (!teacherSubjects) return;
  const selected = new Set(selectedSubjects());
  const fromTeachers = (state.teachers || []).flatMap((t) => t.subjects || []);
  const all = uniq([...DEFAULT_SUBJECTS, ...state.customSubjects, ...fromTeachers]).sort((a, b) => a.localeCompare(b, "es"));

  teacherSubjects.innerHTML = "";
  all.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (selected.has(name)) opt.selected = true;
    teacherSubjects.appendChild(opt);
  });
}

function syncTutorOptions() {
  if (!teacherTutorGroupId) return;
  const selected = new Set(selectedGroupIds());
  const current = String(teacherTutorGroupId.value || "");
  teacherTutorGroupId.innerHTML = '<option value="">Sin tutoría</option>';

  (state.groups || []).forEach((g) => {
    if (!selected.has(g.id)) return;
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.level ? `${g.name} · ${g.level}` : g.name;
    teacherTutorGroupId.appendChild(opt);
  });

  if (current && selected.has(current)) {
    teacherTutorGroupId.value = current;
  }
}

function renderGroups() {
  if (!teacherGroupIds) return;
  const selected = new Set(selectedGroupIds());
  teacherGroupIds.innerHTML = "";

  (state.groups || []).forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.level ? `${g.name} · ${g.level}` : g.name;
    if (selected.has(g.id)) opt.selected = true;
    teacherGroupIds.appendChild(opt);
  });

  syncTutorOptions();
}

function chip(text) {
  return `<span class="chip">${text}</span>`;
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
        ? item.subjects.map((s) => chip(s)).join("")
        : '<span class="teacherMeta">Sin materias</span>';
      const groups = item.groups?.length
        ? item.groups.map((g) => chip(`${g.name}${g.is_tutor ? " (tutoría)" : ""}`)).join("")
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

function parseTracks() {
  const raw = String(trackListInput?.value || "").trim();
  const list = raw
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  if (list.length >= 1) return uniq(list);
  return ["A", "B", "C", "D", "E"];
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

async function reloadData() {
  setError("");
  setResult("");
  state.groups = (await fetchJSON("/api/v1/groups?limit=500&offset=0")).items || [];
  state.teachers = (await fetchJSON("/api/v1/admin/teachers")).items || [];

  if (!state.groups.length) {
    setError("No hay grupos creados para este centro. Usa 'Generar grupos estándar'.");
  }

  renderSubjects();
  renderGroups();
  renderTeachers();
}

async function createInvite() {
  setError("");
  setResult("");

  const email = String(teacherEmail?.value || "").trim();
  const displayName = String(teacherDisplayName?.value || "").trim();
  const subjects = selectedSubjects();
  const groupIds = selectedGroupIds();
  const tutorGroupId = String(teacherTutorGroupId?.value || "").trim();

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
      tutor_group_id: tutorGroupId || null,
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
  const value = String(newSubjectInput?.value || "").trim();
  if (!value) return;
  state.customSubjects = uniq([...state.customSubjects, value]);
  newSubjectInput.value = "";
  renderSubjects();

  const options = teacherSubjects?.options || [];
  for (let i = 0; i < options.length; i += 1) {
    if (options[i].value === value) options[i].selected = true;
  }
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

  addSubjectBtn?.addEventListener("click", addCustomSubject);
  newSubjectInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addCustomSubject();
    }
  });

  teacherGroupIds?.addEventListener("change", syncTutorOptions);

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

  let tenantSlug = String(getTenantSlug() || "").trim();
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
    if (flags.hasTeacher) {
      goTeacher();
      return;
    }
    if (flags.hasStudent) {
      goStudent();
      return;
    }
    window.location.href = "/index.html";
    return;
  }

  if (tenantEl) tenantEl.textContent = state.tenantName || "—";

  wireEvents();
  renderSubjects();
  await reloadData();
}

init().catch((err) => {
  setError(err?.message || "No se pudo cargar la zona admin.");
});
