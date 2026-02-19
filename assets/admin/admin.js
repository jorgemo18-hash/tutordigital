import {
  apiFetch,
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
} from "../shared/js/auth.js";

const tenantEl = document.getElementById("adminTenant");
const roleEl = document.getElementById("adminRole");
const emailEl = document.getElementById("adminEmail");
const errorEl = document.getElementById("adminError");
const resultEl = document.getElementById("adminInviteResult");

const teacherEmail = document.getElementById("teacherEmail");
const teacherDisplayName = document.getElementById("teacherDisplayName");
const teacherSubjects = document.getElementById("teacherSubjects");
const teacherGroupIds = document.getElementById("teacherGroupIds");
const teacherTutorGroupId = document.getElementById("teacherTutorGroupId");

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

async function fetchJSON(path, options = {}) {
  const res = await apiFetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body?.data || body || {};
}

function parseSubjects(input = "") {
  return String(input)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function selectedGroupIds() {
  const values = [];
  const options = teacherGroupIds?.options || [];
  for (let i = 0; i < options.length; i += 1) {
    if (options[i].selected) values.push(options[i].value);
  }
  return values;
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
    opt.textContent = g.name || g.id;
    teacherTutorGroupId.appendChild(opt);
  });

  if (current && selected.has(current)) {
    teacherTutorGroupId.value = current;
  }
}

function renderGroups() {
  if (!teacherGroupIds) return;
  teacherGroupIds.innerHTML = "";
  (state.groups || []).forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.level ? `${g.name} · ${g.level}` : g.name;
    teacherGroupIds.appendChild(opt);
  });
  syncTutorOptions();
}

function chip(text) {
  return `<span class="chip">${text}</span>`;
}

function renderTeachers() {
  if (!teachersList) return;
  const items = state.teachers || [];
  if (!items.length) {
    teachersList.innerHTML = '<p class="teacherMeta">Sin docentes configurados.</p>';
    return;
  }

  teachersList.innerHTML = items
    .map((item) => {
      const subjects = item.subjects?.length
        ? item.subjects.map((s) => chip(s)).join("")
        : '<span class="teacherMeta">Sin materias</span>';
      const groups = item.groups?.length
        ? item.groups.map((g) => chip(`${g.name}${g.is_tutor ? " (tutor)" : ""}`)).join("")
        : '<span class="teacherMeta">Sin grupos</span>';
      const inviteLabel = item.invite?.status ? item.invite.status : "sin invitación";

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
            ${item.invite?.status === "pending" ? `<button class="btn ghost" data-revoke-id="${item.invite.id}">Revocar invitación</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

async function reloadData() {
  setError("");
  setResult("");
  state.groups = (await fetchJSON("/api/v1/groups?limit=200&offset=0")).items || [];
  state.teachers = (await fetchJSON("/api/v1/admin/teachers")).items || [];
  renderGroups();
  renderTeachers();
}

async function createInvite() {
  setError("");
  setResult("");

  const email = String(teacherEmail?.value || "").trim();
  const displayName = String(teacherDisplayName?.value || "").trim();
  const subjects = parseSubjects(teacherSubjects?.value || "");
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
  setResult(`Invitación creada para ${invite.email || email}\nCódigo: ${invite.code || "(sin código)"}`);

  try {
    if (invite?.code && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(invite.code);
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
  if (roleEl) roleEl.textContent = "admin";
  if (emailEl) emailEl.textContent = me?.user?.email || "—";

  wireEvents();
  await reloadData();
}

init().catch((err) => {
  setError(err?.message || "No se pudo cargar la zona admin.");
});
