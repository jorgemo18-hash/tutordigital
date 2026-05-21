export const ACCESS_KEY_BASE = "ttd_teacherAccess";
export const DATA_KEY_BASE = "ttd_teacherData";
export const GROUP_KEY_BASE = "ttd_teacherGroup";
export const THEME_KEY_BASE = "ttdTheme";
export const STUDENT_ORDER_KEY_BASE = "ttd_teacherStudentOrder";
export const TENANT_CFG_KEY_BASE = "ttd_tenantCfg";
export const TEACHER_SESSION_KEY_BASE = "ttd_teacherSession";

export const STATUS_CONFIG = {
  needs_teacher: { label: "Necesita profesor", emoji: "🔴" },
  pending: { label: "Pendiente", emoji: "🟡" },
  submitted: { label: "Ok", emoji: "🟢" }
};

export const STATUS_ORDER = ["needs_teacher", "pending", "submitted"];

export const TYPE_LABELS = {
  homework: "Deberes",
  exam: "Exámenes",
  work: "Trabajos"
};

export function createInitialState() {
  return {
    tenantId: "lyceo",
    activeUser: null,
    data: null,
    currentGroupId: null,
    currentTeacherId: null,
    currentTeacherName: "",
    currentRole: null,
    range: "today",
    activeTicketId: null,
    activeTaskId: null,
    activeNotebookStudentId: null,
    studentOrder: "status",
    studentApprovalView: "approved",
    teacherRequestView: "pending",
    notebookMode: "week",
    notebookMonth: "",
    notebookTerm: "t1",
    studentGroupOpen: {
      needs_teacher: true,
      pending: false,
      submitted: false
    }
  };
}

export function sanitizeTenantSlug(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function getTenantId() {
  try {
    const stored = localStorage.getItem("ttd_activeTenantSlug") || "";
    return sanitizeTenantSlug(stored || "");
  } catch {
    return "";
  }
}

export function getDataKey(tenantId) {
  const normalized = sanitizeTenantSlug(tenantId);
  return `${DATA_KEY_BASE}_${normalized}`;
}

export function getGroupKey(tenantId) {
  const normalized = sanitizeTenantSlug(tenantId);
  return `${GROUP_KEY_BASE}_${normalized}`;
}

export function getStudentOrderKey(tenantId) {
  const normalized = sanitizeTenantSlug(tenantId);
  return `${STUDENT_ORDER_KEY_BASE}_${normalized}`;
}

export function getAccessKey(tenantId) {
  const normalized = sanitizeTenantSlug(tenantId);
  return `${ACCESS_KEY_BASE}_${normalized}`;
}

export function getTenantCfgKey(tenantId) {
  const normalized = sanitizeTenantSlug(tenantId);
  return `${TENANT_CFG_KEY_BASE}_${normalized}`;
}

export function getTeacherSessionKey(tenantId) {
  const normalized = sanitizeTenantSlug(tenantId);
  return `${TEACHER_SESSION_KEY_BASE}_${normalized}`;
}

export function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: name || "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function normalizeStudent(student) {
  if (!student) return student;
  if (!student.firstName || !student.lastName) {
    const parts = splitName(student.name || "");
    student.firstName = student.firstName || parts.first;
    student.lastName = student.lastName || parts.last;
    if (student.firstName || student.lastName) {
      student.name = `${student.firstName || ""} ${student.lastName || ""}`.trim();
    }
  }
  return student;
}

export function formatStudentName(student) {
  if (!student) return "";
  const first = student.firstName || "";
  const last = student.lastName || "";
  if (!last) return student.name || first;
  return `${last}, ${first}`.trim();
}

export function compareBySurname(a, b) {
  const aLast = (a.lastName || "").toString();
  const bLast = (b.lastName || "").toString();
  const lastCompare = aLast.localeCompare(bLast, "es-ES", { sensitivity: "base" });
  if (lastCompare !== 0) return lastCompare;
  const aFirst = (a.firstName || "").toString();
  const bFirst = (b.firstName || "").toString();
  return aFirst.localeCompare(bFirst, "es-ES", { sensitivity: "base" });
}

function createEmptyData() {
  return {
    teachers: [],
    groups: [],
    students: [],
    tasks: [],
    taskStatus: {},
    tickets: [],
    notebook: {},
    grades: {}
  };
}

export function loadData(tenantId, teacherId) {
  const normalized = sanitizeTenantSlug(tenantId);
  let raw = localStorage.getItem(getDataKey(normalized));
  if (!raw && normalized === "lyceo") {
    const legacy = localStorage.getItem(getDataKey("instituto1"));
    if (legacy) {
      raw = legacy;
      localStorage.setItem(getDataKey(normalized), legacy);
    }
  }
  if (!raw) {
    const empty = createEmptyData();
    localStorage.setItem(getDataKey(normalized), JSON.stringify(empty));
    return empty;
  }

  try {
    const data = JSON.parse(raw);
    let dirty = false;
    if (!data.notebook || typeof data.notebook !== "object") {
      data.notebook = {};
      dirty = true;
    }
    if (!data.taskStatus || typeof data.taskStatus !== "object") {
      data.taskStatus = {};
      dirty = true;
    }
    if (!data.grades || typeof data.grades !== "object") {
      data.grades = {};
      dirty = true;
    }
    if (!Array.isArray(data.teachers)) {
      data.teachers = [];
      dirty = true;
    }
    if (Array.isArray(data.groups)) {
      data.groups.forEach(group => {
        if (!group.tenantId) {
          group.tenantId = normalized;
          dirty = true;
        }
        if (!group.level) {
          group.level = "eso";
          dirty = true;
        }
      });
    }
    if (Array.isArray(data.students)) {
      data.students.forEach(student => {
        const beforeFirst = student.firstName;
        const beforeLast = student.lastName;
        normalizeStudent(student);
        if (!student.tenantId) {
          student.tenantId = normalized;
          dirty = true;
        }
        if (student.firstName !== beforeFirst || student.lastName !== beforeLast) dirty = true;
      });
    }
    if (Array.isArray(data.tasks)) {
      data.tasks.forEach(task => {
        if (!task.tenantId) {
          task.tenantId = normalized;
          dirty = true;
        }
        if (!task.teacherId && teacherId) {
          task.teacherId = teacherId;
          dirty = true;
        }
      });
    }
    if (Array.isArray(data.tickets)) {
      data.tickets.forEach(ticket => {
        if (!ticket.tenantId) {
          ticket.tenantId = normalized;
          dirty = true;
        }
        if (!ticket.teacherId && teacherId) {
          ticket.teacherId = teacherId;
          dirty = true;
        }
      });
    }
    if (dirty) {
      localStorage.setItem(getDataKey(tenantId), JSON.stringify(data));
    }
    return data;
  } catch (error) {
    const empty = createEmptyData();
    localStorage.setItem(getDataKey(normalized), JSON.stringify(empty));
    return empty;
  }
}

export function saveData(tenantId, data) {
  localStorage.setItem(getDataKey(tenantId), JSON.stringify(data));
}

export function refreshData(state, tenantId, teacherId) {
  state.data = loadData(tenantId, teacherId);
}

export function hasAccess(tenantId) {
  return localStorage.getItem(`ttd_tenantAccess_${sanitizeTenantSlug(tenantId)}`) === "ok";
}

export function loadTenantCfg(tenantId) {
  const normalized = sanitizeTenantSlug(tenantId);
  const key = getTenantCfgKey(normalized);
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }
  const cfg = {
    name: normalized === "instituto2" ? "Instituto 2 (demo)" : "Lyceo (demo)",
    subtitle: "Zona docente",
    bgImage: "/assets/bg/instituto.jpg"
  };
  localStorage.setItem(key, JSON.stringify(cfg));
  return cfg;
}

export function saveTenantCfg(tenantId, cfg) {
  const normalized = sanitizeTenantSlug(tenantId);
  localStorage.setItem(getTenantCfgKey(normalized), JSON.stringify(cfg));
}

export function loadTeacherSession(tenantId) {
  const raw = localStorage.getItem(getTeacherSessionKey(tenantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveTeacherSession(tenantId, session) {
  localStorage.setItem(getTeacherSessionKey(tenantId), JSON.stringify(session));
}

export function clearTeacherSession(tenantId) {
  localStorage.removeItem(getTeacherSessionKey(tenantId));
}

export function migrateTeacherScopedData(data, teacherId) {
  let dirty = false;
  if (!data.taskStatus || typeof data.taskStatus !== "object") {
    data.taskStatus = {};
    dirty = true;
  }
  if (!data.grades || typeof data.grades !== "object") {
    data.grades = {};
    dirty = true;
  }
  if (data.taskStatus && data.taskStatus[teacherId] == null) {
    const keys = Object.keys(data.taskStatus);
    const looksLikeTaskMap = keys.some(key => key.startsWith("t"));
    if (keys.length && looksLikeTaskMap) {
      data.taskStatus = { [teacherId]: data.taskStatus };
      dirty = true;
    } else if (!keys.length) {
      data.taskStatus[teacherId] = {};
      dirty = true;
    } else {
      data.taskStatus[teacherId] = {};
      dirty = true;
    }
  }
  if (data.grades && data.grades[teacherId] == null) {
    const keys = Object.keys(data.grades);
    const looksLikeStudentMap = keys.some(key => key.startsWith("s"));
    if (keys.length && looksLikeStudentMap) {
      data.grades = { [teacherId]: data.grades };
      dirty = true;
    } else if (!keys.length) {
      data.grades[teacherId] = {};
      dirty = true;
    } else {
      data.grades[teacherId] = {};
      dirty = true;
    }
  }
  if (Array.isArray(data.tasks)) {
    data.tasks.forEach(task => {
      if (!task.teacherId && teacherId) {
        task.teacherId = teacherId;
        dirty = true;
      }
    });
  }
  if (Array.isArray(data.tickets)) {
    data.tickets.forEach(ticket => {
      if (!ticket.teacherId && teacherId) {
        ticket.teacherId = teacherId;
        dirty = true;
      }
    });
  }
  return dirty;
}
