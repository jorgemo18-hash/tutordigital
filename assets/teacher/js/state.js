import { addDays, formatDate } from "./utils.js";

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
    range: "today",
    activeTicketId: null,
    activeTaskId: null,
    activeNotebookStudentId: null,
    studentOrder: "status",
    notebookMode: "month",
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

export function seedData(tenantId) {
  const tId = sanitizeTenantSlug(tenantId) || "lyceo";
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const later = addDays(today, 4);
  const week = addDays(today, 6);

  const teachers = [
    { id: "p1", name: "Profe A" },
    { id: "p2", name: "Profe B" }
  ];

  const groups = [
    { id: "g1", name: "1º ESO A" },
    { id: "g2", name: "1º ESO B" },
    { id: "g3", name: "1º ESO C" },
    { id: "g4", name: "2º ESO A" },
    { id: "g5", name: "2º ESO B" },
    { id: "g6", name: "2º ESO C" },
    { id: "g7", name: "3º ESO A" },
    { id: "g8", name: "3º ESO B" },
    { id: "g9", name: "3º ESO C" },
    { id: "g10", name: "4º ESO A" },
    { id: "g11", name: "4º ESO B" },
    { id: "g12", name: "4º ESO C" }
  ];

  const students = [
    { id: "s1", firstName: "Claudia", lastName: "Suarez", name: "Claudia Suarez", groupId: "g1", status: "submitted" },
    { id: "s2", firstName: "Alvaro", lastName: "Soler", name: "Alvaro Soler", groupId: "g1", status: "pending" },
    { id: "s3", firstName: "Hugo", lastName: "Martin", name: "Hugo Martin", groupId: "g1", status: "needs_teacher" },
    { id: "s4", name: "Ines Santos", groupId: "g1", status: "submitted" },
    { id: "s5", name: "Diego Flores", groupId: "g1", status: "pending" },
    { id: "s6", name: "Hugo Pascual", groupId: "g1", status: "needs_teacher" },
    { id: "s7", name: "Daniel Ramos", groupId: "g1", status: "submitted" },
    { id: "s8", name: "Mateo Fuentes", groupId: "g1", status: "pending" },
    { id: "s9", name: "Nora Martin", groupId: "g1", status: "needs_teacher" },
    { id: "s10", name: "Adrian Navarro", groupId: "g1", status: "submitted" },
    { id: "s11", name: "Alex Fuentes", groupId: "g1", status: "pending" },
    { id: "s12", name: "Hugo Rojas", groupId: "g1", status: "needs_teacher" },
    { id: "s13", name: "Leo Rubio", groupId: "g1", status: "submitted" },
    { id: "s14", name: "Jimena Mendez", groupId: "g1", status: "pending" },
    { id: "s15", name: "Ruben Perez", groupId: "g1", status: "needs_teacher" },
    { id: "s16", name: "Manuela Flores", groupId: "g1", status: "submitted" },
    { id: "s17", name: "Alvaro Perez", groupId: "g1", status: "pending" },
    { id: "s18", name: "Carla Ramos", groupId: "g1", status: "needs_teacher" },
    { id: "s19", name: "Alex Vega", groupId: "g1", status: "submitted" },
    { id: "s20", name: "Aitana Prieto", groupId: "g1", status: "pending" },
    { id: "s21", name: "Lucas Montero", groupId: "g2", status: "pending" },
    { id: "s22", name: "Leo Rojas", groupId: "g2", status: "needs_teacher" },
    { id: "s23", name: "Javier Cano", groupId: "g2", status: "submitted" },
    { id: "s24", name: "Eric Iglesias", groupId: "g2", status: "pending" },
    { id: "s25", name: "Sofia Flores", groupId: "g2", status: "needs_teacher" },
    { id: "s26", name: "Manuela Mendez", groupId: "g2", status: "submitted" },
    { id: "s27", name: "Paula Rey", groupId: "g2", status: "pending" },
    { id: "s28", name: "Sofia Cano", groupId: "g2", status: "needs_teacher" },
    { id: "s29", name: "Pedro Martin", groupId: "g2", status: "submitted" },
    { id: "s30", name: "Manuela Perez", groupId: "g2", status: "pending" },
    { id: "s31", name: "Samuel Ortega", groupId: "g2", status: "needs_teacher" },
    { id: "s32", name: "Mario Reyes", groupId: "g2", status: "submitted" },
    { id: "s33", name: "Ines Fuentes", groupId: "g2", status: "pending" },
    { id: "s34", name: "Ivan Castro", groupId: "g2", status: "needs_teacher" },
    { id: "s35", name: "Bruno Flores", groupId: "g2", status: "submitted" },
    { id: "s36", name: "Bruno Rey", groupId: "g2", status: "pending" },
    { id: "s37", name: "Javier Serrano", groupId: "g2", status: "needs_teacher" },
    { id: "s38", name: "Nico Moreno", groupId: "g2", status: "submitted" },
    { id: "s39", name: "Ivan Serrano", groupId: "g2", status: "pending" },
    { id: "s40", name: "Mateo Rojas", groupId: "g2", status: "needs_teacher" },
    { id: "s41", name: "Javier Marin", groupId: "g3", status: "needs_teacher" },
    { id: "s42", name: "Mario Garrido", groupId: "g3", status: "submitted" },
    { id: "s43", name: "Leire Vidal", groupId: "g3", status: "pending" },
    { id: "s44", name: "Aitana Calvo", groupId: "g3", status: "needs_teacher" },
    { id: "s45", name: "Noa Diaz", groupId: "g3", status: "submitted" },
    { id: "s46", name: "Sara Prieto", groupId: "g3", status: "pending" },
    { id: "s47", name: "Irene Garrido", groupId: "g3", status: "needs_teacher" },
    { id: "s48", name: "Lucas Aguilar", groupId: "g3", status: "submitted" },
    { id: "s49", name: "Nora Ramos", groupId: "g3", status: "pending" },
    { id: "s50", name: "Lina Martin", groupId: "g3", status: "needs_teacher" },
    { id: "s51", name: "Elsa Cano", groupId: "g3", status: "submitted" },
    { id: "s52", name: "Manuela Castro", groupId: "g3", status: "pending" },
    { id: "s53", name: "Sergio Moreno", groupId: "g3", status: "needs_teacher" },
    { id: "s54", name: "Vera Calvo", groupId: "g3", status: "submitted" },
    { id: "s55", name: "Mario Flores", groupId: "g3", status: "pending" },
    { id: "s56", name: "Bruno Martin", groupId: "g3", status: "needs_teacher" },
    { id: "s57", name: "Mateo Ramirez", groupId: "g3", status: "submitted" },
    { id: "s58", name: "Celia Moreno", groupId: "g3", status: "pending" },
    { id: "s59", name: "Lina Martin", groupId: "g3", status: "needs_teacher" },
    { id: "s60", name: "Hugo Navas", groupId: "g3", status: "submitted" },
    { id: "s61", name: "Aroa Medina", groupId: "g4", status: "submitted" },
    { id: "s62", name: "Gael Rojas", groupId: "g4", status: "pending" },
    { id: "s63", name: "Eric Vidal", groupId: "g4", status: "needs_teacher" },
    { id: "s64", name: "Aitana Nieto", groupId: "g4", status: "submitted" },
    { id: "s65", name: "Laia Sanz", groupId: "g4", status: "pending" },
    { id: "s66", name: "Vera Gil", groupId: "g4", status: "needs_teacher" },
    { id: "s67", name: "Bruno Cortes", groupId: "g4", status: "submitted" },
    { id: "s68", name: "Irene Ferrer", groupId: "g4", status: "pending" },
    { id: "s69", name: "Leo Aguilar", groupId: "g4", status: "needs_teacher" },
    { id: "s70", name: "Hugo Ortega", groupId: "g4", status: "submitted" },
    { id: "s71", name: "Ivan Herrera", groupId: "g4", status: "pending" },
    { id: "s72", name: "Valeria Arroyo", groupId: "g4", status: "needs_teacher" },
    { id: "s73", name: "Adrian Campos", groupId: "g4", status: "submitted" },
    { id: "s74", name: "Alvaro Aguilar", groupId: "g4", status: "pending" },
    { id: "s75", name: "Mateo Mora", groupId: "g4", status: "needs_teacher" },
    { id: "s76", name: "Eva Campos", groupId: "g4", status: "submitted" },
    { id: "s77", name: "Alex Ramirez", groupId: "g4", status: "pending" },
    { id: "s78", name: "Valeria Fuentes", groupId: "g4", status: "needs_teacher" },
    { id: "s79", name: "Alex Ramirez", groupId: "g4", status: "submitted" },
    { id: "s80", name: "Pedro Prieto", groupId: "g4", status: "pending" },
    { id: "s81", name: "Vera Reyes", groupId: "g5", status: "pending" },
    { id: "s82", name: "Laia Rubio", groupId: "g5", status: "needs_teacher" },
    { id: "s83", name: "Lucas Navarro", groupId: "g5", status: "submitted" },
    { id: "s84", name: "Nico Suarez", groupId: "g5", status: "pending" },
    { id: "s85", name: "Carla Sanz", groupId: "g5", status: "needs_teacher" },
    { id: "s86", name: "Carla Torres", groupId: "g5", status: "submitted" },
    { id: "s87", name: "Mario Flores", groupId: "g5", status: "pending" },
    { id: "s88", name: "Nico Delgado", groupId: "g5", status: "needs_teacher" },
    { id: "s89", name: "Aitana Torres", groupId: "g5", status: "submitted" },
    { id: "s90", name: "Lucas Prieto", groupId: "g5", status: "pending" },
    { id: "s91", name: "Ines Rey", groupId: "g5", status: "needs_teacher" },
    { id: "s92", name: "Samuel Rojas", groupId: "g5", status: "submitted" },
    { id: "s93", name: "Claudia Vega", groupId: "g5", status: "pending" },
    { id: "s94", name: "Aroa Pascual", groupId: "g5", status: "needs_teacher" },
    { id: "s95", name: "Samuel Soler", groupId: "g5", status: "submitted" },
    { id: "s96", name: "Eric Arroyo", groupId: "g5", status: "pending" },
    { id: "s97", name: "Hugo Romero", groupId: "g5", status: "needs_teacher" },
    { id: "s98", name: "Ivan Reyes", groupId: "g5", status: "submitted" },
    { id: "s99", name: "Alex Campos", groupId: "g5", status: "pending" },
    { id: "s100", name: "Alvaro Campos", groupId: "g5", status: "needs_teacher" },
    { id: "s101", name: "Alvaro Santos", groupId: "g6", status: "needs_teacher" },
    { id: "s102", name: "Celia Mendez", groupId: "g6", status: "submitted" },
    { id: "s103", name: "Alvaro Perez", groupId: "g6", status: "pending" },
    { id: "s104", name: "Paula Martin", groupId: "g6", status: "needs_teacher" },
    { id: "s105", name: "Daniel Vidal", groupId: "g6", status: "submitted" },
    { id: "s106", name: "Irene Diaz", groupId: "g6", status: "pending" },
    { id: "s107", name: "Sergio Calvo", groupId: "g6", status: "needs_teacher" },
    { id: "s108", name: "Hugo Santos", groupId: "g6", status: "submitted" },
    { id: "s109", name: "Lucia Rojas", groupId: "g6", status: "pending" },
    { id: "s110", name: "Lucas Montero", groupId: "g6", status: "needs_teacher" },
    { id: "s111", name: "Sofia Rey", groupId: "g6", status: "submitted" },
    { id: "s112", name: "Samuel Gil", groupId: "g6", status: "pending" },
    { id: "s113", name: "Noa Ortega", groupId: "g6", status: "needs_teacher" },
    { id: "s114", name: "Samuel Guerrero", groupId: "g6", status: "submitted" },
    { id: "s115", name: "Lucas Mendez", groupId: "g6", status: "pending" },
    { id: "s116", name: "Marta Cortes", groupId: "g6", status: "needs_teacher" },
    { id: "s117", name: "Lola Rey", groupId: "g6", status: "submitted" },
    { id: "s118", name: "Celia Diaz", groupId: "g6", status: "pending" },
    { id: "s119", name: "Leo Aguilar", groupId: "g6", status: "needs_teacher" },
    { id: "s120", name: "Bruno Herrero", groupId: "g6", status: "submitted" },
    { id: "s121", name: "Celia Medina", groupId: "g7", status: "submitted" },
    { id: "s122", name: "Mateo Suarez", groupId: "g7", status: "pending" },
    { id: "s123", name: "Sofia Arroyo", groupId: "g7", status: "needs_teacher" },
    { id: "s124", name: "Sergio Arroyo", groupId: "g7", status: "submitted" },
    { id: "s125", name: "Marta Herrero", groupId: "g7", status: "pending" },
    { id: "s126", name: "Aroa Mora", groupId: "g7", status: "needs_teacher" },
    { id: "s127", name: "Hector Gil", groupId: "g7", status: "submitted" },
    { id: "s128", name: "Daniel Marin", groupId: "g7", status: "pending" },
    { id: "s129", name: "Diego Suarez", groupId: "g7", status: "needs_teacher" },
    { id: "s130", name: "Aroa Montero", groupId: "g7", status: "submitted" },
    { id: "s131", name: "Marco Marin", groupId: "g7", status: "pending" },
    { id: "s132", name: "Javier Soler", groupId: "g7", status: "needs_teacher" },
    { id: "s133", name: "Mateo Moreno", groupId: "g7", status: "submitted" },
    { id: "s134", name: "Marta Marin", groupId: "g7", status: "pending" },
    { id: "s135", name: "Diego Mora", groupId: "g7", status: "needs_teacher" },
    { id: "s136", name: "Vera Rubio", groupId: "g7", status: "submitted" },
    { id: "s137", name: "Ines Montero", groupId: "g7", status: "pending" },
    { id: "s138", name: "Ivan Pascual", groupId: "g7", status: "needs_teacher" },
    { id: "s139", name: "Sergio Mendez", groupId: "g7", status: "submitted" },
    { id: "s140", name: "Carla Ferrer", groupId: "g7", status: "pending" },
    { id: "s141", name: "Elsa Cruz", groupId: "g8", status: "pending" },
    { id: "s142", name: "Adrian Campos", groupId: "g8", status: "needs_teacher" },
    { id: "s143", name: "Hugo Rubio", groupId: "g8", status: "submitted" },
    { id: "s144", name: "Paula Marin", groupId: "g8", status: "pending" },
    { id: "s145", name: "Mario Cortes", groupId: "g8", status: "needs_teacher" },
    { id: "s146", name: "Leire Gil", groupId: "g8", status: "submitted" },
    { id: "s147", name: "Marco Ramirez", groupId: "g8", status: "pending" },
    { id: "s148", name: "Celia Delgado", groupId: "g8", status: "needs_teacher" },
    { id: "s149", name: "Paula Moreno", groupId: "g8", status: "submitted" },
    { id: "s150", name: "Lola Cortes", groupId: "g8", status: "pending" },
    { id: "s151", name: "Eva Navas", groupId: "g8", status: "needs_teacher" },
    { id: "s152", name: "Vera Rey", groupId: "g8", status: "submitted" },
    { id: "s153", name: "Mateo Rubio", groupId: "g8", status: "pending" },
    { id: "s154", name: "Sofia Rubio", groupId: "g8", status: "needs_teacher" },
    { id: "s155", name: "Celia Cruz", groupId: "g8", status: "submitted" },
    { id: "s156", name: "Sergio Ortega", groupId: "g8", status: "pending" },
    { id: "s157", name: "Celia Ferrer", groupId: "g8", status: "needs_teacher" },
    { id: "s158", name: "Samuel Torres", groupId: "g8", status: "submitted" },
    { id: "s159", name: "Celia Soler", groupId: "g8", status: "pending" },
    { id: "s160", name: "Vera Soler", groupId: "g8", status: "needs_teacher" },
    { id: "s161", name: "Mateo Sanz", groupId: "g9", status: "needs_teacher" },
    { id: "s162", name: "Leo Guerrero", groupId: "g9", status: "submitted" },
    { id: "s163", name: "Pedro Cruz", groupId: "g9", status: "pending" },
    { id: "s164", name: "Celia Iglesias", groupId: "g9", status: "needs_teacher" },
    { id: "s165", name: "Gonzalo Mendez", groupId: "g9", status: "submitted" },
    { id: "s166", name: "Sergio Navarro", groupId: "g9", status: "pending" },
    { id: "s167", name: "Leire Campos", groupId: "g9", status: "needs_teacher" },
    { id: "s168", name: "Bruno Campos", groupId: "g9", status: "submitted" },
    { id: "s169", name: "Hugo Navarro", groupId: "g9", status: "pending" },
    { id: "s170", name: "Leire Mora", groupId: "g9", status: "needs_teacher" },
    { id: "s171", name: "Irene Vega", groupId: "g9", status: "submitted" },
    { id: "s172", name: "Marco Suarez", groupId: "g9", status: "pending" },
    { id: "s173", name: "Ruben Romero", groupId: "g9", status: "needs_teacher" },
    { id: "s174", name: "Gael Suarez", groupId: "g9", status: "submitted" },
    { id: "s175", name: "Samuel Calvo", groupId: "g9", status: "pending" },
    { id: "s176", name: "Celia Sanz", groupId: "g9", status: "needs_teacher" },
    { id: "s177", name: "Vera Suarez", groupId: "g9", status: "submitted" },
    { id: "s178", name: "Alex Cano", groupId: "g9", status: "pending" },
    { id: "s179", name: "Valeria Gil", groupId: "g9", status: "needs_teacher" },
    { id: "s180", name: "Lucia Navas", groupId: "g9", status: "submitted" },
    { id: "s181", name: "Gael Santos", groupId: "g10", status: "submitted" },
    { id: "s182", name: "Hector Arroyo", groupId: "g10", status: "pending" },
    { id: "s183", name: "Valeria Fuentes", groupId: "g10", status: "needs_teacher" },
    { id: "s184", name: "Paula Ortega", groupId: "g10", status: "submitted" },
    { id: "s185", name: "Marco Delgado", groupId: "g10", status: "pending" },
    { id: "s186", name: "Daniel Herrera", groupId: "g10", status: "needs_teacher" },
    { id: "s187", name: "Sara Serrano", groupId: "g10", status: "submitted" },
    { id: "s188", name: "Elsa Flores", groupId: "g10", status: "pending" },
    { id: "s189", name: "Claudia Delgado", groupId: "g10", status: "needs_teacher" },
    { id: "s190", name: "Ines Prieto", groupId: "g10", status: "submitted" },
    { id: "s191", name: "Valeria Perez", groupId: "g10", status: "pending" },
    { id: "s192", name: "Hugo Cortes", groupId: "g10", status: "needs_teacher" },
    { id: "s193", name: "Bruno Sanz", groupId: "g10", status: "submitted" },
    { id: "s194", name: "Ruben Marin", groupId: "g10", status: "pending" },
    { id: "s195", name: "Nora Pascual", groupId: "g10", status: "needs_teacher" },
    { id: "s196", name: "Valeria Montero", groupId: "g10", status: "submitted" },
    { id: "s197", name: "Lucas Marin", groupId: "g10", status: "pending" },
    { id: "s198", name: "Sara Gil", groupId: "g10", status: "needs_teacher" },
    { id: "s199", name: "Eva Iglesias", groupId: "g10", status: "submitted" },
    { id: "s200", name: "Lola Torres", groupId: "g10", status: "pending" },
    { id: "s201", name: "Ivan Suarez", groupId: "g11", status: "pending" },
    { id: "s202", name: "Nico Suarez", groupId: "g11", status: "needs_teacher" },
    { id: "s203", name: "Celia Ferrer", groupId: "g11", status: "submitted" },
    { id: "s204", name: "Leire Diaz", groupId: "g11", status: "pending" },
    { id: "s205", name: "Alex Perez", groupId: "g11", status: "needs_teacher" },
    { id: "s206", name: "Claudia Reyes", groupId: "g11", status: "submitted" },
    { id: "s207", name: "Hector Marin", groupId: "g11", status: "pending" },
    { id: "s208", name: "Alex Herrero", groupId: "g11", status: "needs_teacher" },
    { id: "s209", name: "Ivan Santos", groupId: "g11", status: "submitted" },
    { id: "s210", name: "Alex Perez", groupId: "g11", status: "pending" },
    { id: "s211", name: "Adrian Cruz", groupId: "g11", status: "needs_teacher" },
    { id: "s212", name: "Pablo Ramos", groupId: "g11", status: "submitted" },
    { id: "s213", name: "Ivan Santos", groupId: "g11", status: "pending" },
    { id: "s214", name: "Sara Vidal", groupId: "g11", status: "needs_teacher" },
    { id: "s215", name: "Alex Gil", groupId: "g11", status: "submitted" },
    { id: "s216", name: "Elsa Martin", groupId: "g11", status: "pending" },
    { id: "s217", name: "Eva Castro", groupId: "g11", status: "needs_teacher" },
    { id: "s218", name: "Samuel Pascual", groupId: "g11", status: "submitted" },
    { id: "s219", name: "Lola Pascual", groupId: "g11", status: "pending" },
    { id: "s220", name: "Paula Moreno", groupId: "g11", status: "needs_teacher" },
    { id: "s221", name: "Pablo Vidal", groupId: "g12", status: "needs_teacher" },
    { id: "s222", name: "Sara Montero", groupId: "g12", status: "submitted" },
    { id: "s223", name: "Celia Pascual", groupId: "g12", status: "pending" },
    { id: "s224", name: "Adrian Moreno", groupId: "g12", status: "needs_teacher" },
    { id: "s225", name: "Hector Delgado", groupId: "g12", status: "submitted" },
    { id: "s226", name: "Alex Cruz", groupId: "g12", status: "pending" },
    { id: "s227", name: "Eva Vega", groupId: "g12", status: "needs_teacher" },
    { id: "s228", name: "Nora Diaz", groupId: "g12", status: "submitted" },
    { id: "s229", name: "Alvaro Vidal", groupId: "g12", status: "pending" },
    { id: "s230", name: "Claudia Martin", groupId: "g12", status: "needs_teacher" },
    { id: "s231", name: "Lina Serrano", groupId: "g12", status: "submitted" },
    { id: "s232", name: "Gonzalo Martin", groupId: "g12", status: "pending" },
    { id: "s233", name: "Daniel Sanz", groupId: "g12", status: "needs_teacher" },
    { id: "s234", name: "Javier Diaz", groupId: "g12", status: "submitted" },
    { id: "s235", name: "Ivan Suarez", groupId: "g12", status: "pending" },
    { id: "s236", name: "Pedro Soler", groupId: "g12", status: "needs_teacher" },
    { id: "s237", name: "Lina Rey", groupId: "g12", status: "submitted" },
    { id: "s238", name: "Lucas Delgado", groupId: "g12", status: "pending" },
    { id: "s239", name: "Valeria Romero", groupId: "g12", status: "needs_teacher" },
    { id: "s240", name: "Carla Arroyo", groupId: "g12", status: "submitted" }
  ];

  const tasks = [
    {
      id: "t1",
      type: "homework",
      title: "Lectura capítulo 2",
      dueDate: formatDate(today),
      desc: "Apuntar dudas clave.",
      groupId: "g1",
      createdAt: Date.now()
    },
    {
      id: "t2",
      type: "exam",
      title: "Control rápido de verbos",
      dueDate: formatDate(tomorrow),
      desc: "15 minutos en clase.",
      groupId: "g4",
      createdAt: Date.now()
    },
    {
      id: "t3",
      type: "work",
      title: "Trabajo en parejas: ecosistemas",
      dueDate: formatDate(later),
      desc: "Entregar presentación.",
      groupId: "g7",
      createdAt: Date.now()
    },
    {
      id: "t4",
      type: "homework",
      title: "Ejercicios 12-18",
      dueDate: formatDate(week),
      desc: "Resolver en el cuaderno.",
      groupId: "g10",
      createdAt: Date.now()
    }
  ];

  const tickets = [
    {
      id: "k1",
      title: "No entiendo la ecuación 4",
      detail: "He intentado aislar x pero me pierdo en el paso 3.",
      studentId: "s3",
      groupId: "g1",
      status: "open",
      createdAt: formatDate(today)
    },
    {
      id: "k2",
      title: "Revisión de trabajo en parejas",
      detail: "¿Podemos mover la fecha de entrega?",
      studentId: "s64",
      groupId: "g4",
      status: "open",
      createdAt: formatDate(tomorrow)
    }
  ];

  groups.forEach(group => {
    group.tenantId = tId;
    if (!group.level) group.level = "eso";
  });

  students.forEach(student => {
    normalizeStudent(student);
    student.tenantId = tId;
  });

  tasks.forEach((task, index) => {
    task.tenantId = tId;
    if (!task.teacherId) task.teacherId = index % 2 === 0 ? "p1" : "p2";
  });

  tickets.forEach((ticket, index) => {
    ticket.tenantId = tId;
    if (!ticket.teacherId) ticket.teacherId = index % 2 === 0 ? "p1" : "p2";
  });

  return {
    teachers,
    groups,
    students,
    tasks,
    taskStatus: {},
    tickets,
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
    const seeded = seedData(normalized);
    localStorage.setItem(getDataKey(normalized), JSON.stringify(seeded));
    return seeded;
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
      data.teachers = [
        { id: "p1", name: "Profe A" },
        { id: "p2", name: "Profe B" }
      ];
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
    const seeded = seedData(normalized);
    localStorage.setItem(getDataKey(normalized), JSON.stringify(seeded));
    return seeded;
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
