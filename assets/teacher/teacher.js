import { putFile, getFile, deleteFile } from "../shared/js/filesStore.js";

const ACCESS_KEY = "ttd_teacherAccess";
const DATA_KEY = "ttd_teacherData";
const GROUP_KEY = "ttd_teacherGroup";
const THEME_KEY = "ttdTheme";
const STUDENT_ORDER_KEY = "ttd_teacherStudentOrder";

const STATUS_CONFIG = {
  needs_teacher: { label: "Necesita profesor", emoji: "🔴" },
  pending: { label: "Pendiente", emoji: "🟡" },
  submitted: { label: "Ok", emoji: "🟢" }
};

const STATUS_ORDER = ["needs_teacher", "pending", "submitted"];

const TYPE_LABELS = {
  homework: "Deberes",
  exam: "Exámenes",
  work: "Trabajos"
};

const appRoot = document.getElementById("teacherApp");

let elements = {};

let state = {
  data: null,
  currentGroupId: null,
  range: "today",
  activeTicketId: null,
  activeTaskId: null,
  studentOrder: "status",
  studentGroupOpen: "needs_teacher"
};

let pendingAttachments = [];

function getSystemTheme() {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

function getSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return (t === "dark" || t === "light") ? t : "";
  } catch {
    return "";
  }
}

function applyTheme(theme) {
  const t = (theme === "dark" || theme === "light") ? theme : (getSystemTheme() || "dark");
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch {}
}

function updateThemeToggleLabel(btn) {
  if (!btn) return;
  const current = document.documentElement.dataset.theme || getSystemTheme() || "dark";
  btn.textContent = current === "dark" ? "Claro" : "Oscuro";
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatFileSize(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function seedData() {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const later = addDays(today, 4);
  const week = addDays(today, 6);

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

  students.forEach(student => normalizeStudent(student));

  return {
    groups,
    students,
    tasks,
    taskStatus: {},
    tickets,
    notebook: {}
  };
}

function loadData() {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    const seeded = seedData();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const data = JSON.parse(raw);
    if (!data.notebook || typeof data.notebook !== "object") data.notebook = {};
    let dirty = false;
    if (Array.isArray(data.students)) {
      data.students.forEach(student => {
        const beforeFirst = student.firstName;
        const beforeLast = student.lastName;
        normalizeStudent(student);
        if (student.firstName !== beforeFirst || student.lastName !== beforeLast) dirty = true;
      });
    }
    if (dirty) {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    }
    return data;
  } catch (error) {
    const seeded = seedData();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(state.data));
}

function setOverlay(overlay, open) {
  if (!overlay) return;
  overlay.classList.toggle("open", open);
  overlay.setAttribute("aria-hidden", open ? "false" : "true");
}

function hasAccess() {
  return localStorage.getItem(ACCESS_KEY) === "1";
}

function normalizeCode(value) {
  return value.trim().toLowerCase();
}

function getLoginTemplate() {
  return `
    <div class="loginView">
      <div class="loginCard">
        <span class="tag">Tutordigital</span>
        <h1>Zona docente</h1>
        <p>Introduce el código de acceso para continuar.</p>
        <div class="formField">
          <label for="accessCode">Código</label>
          <input id="accessCode" type="password" placeholder="lyceo" autocomplete="one-time-code">
        </div>
        <div class="modalActions">
          <button class="btn primary" id="accessBtn" type="button">Entrar</button>
        </div>
        <p class="hint">Código demo: <strong>lyceo</strong></p>
      </div>
    </div>
  `;
}

function getDashboardTemplate() {
  return `
    <main class="appShell" role="main">
      <header class="appHeader">
        <div class="brand">
          <span class="tag">Tutordigital</span>
          <div>
            <h1>Zona docente</h1>
            <p>IES Jorge Moreno.</p>
          </div>
        </div>
        <div class="headerActions">
          <label class="groupSelect">
            <span>Grupo</span>
            <select id="groupSelect" aria-label="Seleccionar grupo"></select>
          </label>
          <button class="headerAction" id="themeToggle" type="button" aria-label="Cambiar tema">
            Claro
          </button>
          <a class="headerAction" href="/index.html">Inicio</a>
          <button class="headerAction" id="logoutBtn" type="button">Cerrar sesión</button>
        </div>
      </header>

      <section class="appGrid">
        <section class="panel panelTop studentsPanel">
          <div class="panelHeader">
            <div>
              <h2>Alumnos</h2>
              <span class="panelHint">Operativo diario</span>
            </div>
            <div class="studentActions">
              <label class="inlineSelect">
                <span>Orden</span>
                <select id="studentOrder" aria-label="Ordenar alumnos">
                  <option value="status">Estado</option>
                  <option value="surname">Apellido</option>
                </select>
              </label>
              <button class="btn primary" id="addStudentBtn" type="button">+ Añadir alumno</button>
            </div>
          </div>
          <div class="studentList" id="studentList"></div>
          <p class="emptyState" id="studentEmpty">No hay alumnos en este grupo.</p>
        </section>

        <section class="panel panelTop tasksPanel">
          <div class="panelHeader">
            <div>
              <h2>Agenda</h2>
              <span class="panelHint">Filtra por fecha</span>
            </div>
            <div class="taskActions">
              <div class="tabs" role="tablist" aria-label="Filtrar tareas">
                <button class="tabBtn is-active" data-range="today" type="button">Hoy</button>
                <button class="tabBtn" data-range="tomorrow" type="button">Mañana</button>
                <button class="tabBtn" data-range="week" type="button">7 días</button>
              </div>
              <button class="btn primary" id="addTaskBtn" type="button">+ Añadir</button>
            </div>
          </div>

          <div class="taskSections">
            <section class="taskSection">
              <h3>Deberes</h3>
              <div class="taskList" id="taskListHomework"></div>
              <p class="emptyState" id="emptyHomework">Sin deberes en este rango.</p>
            </section>
            <section class="taskSection">
              <h3>Exámenes</h3>
              <div class="taskList" id="taskListExam"></div>
              <p class="emptyState" id="emptyExam">Sin exámenes en este rango.</p>
            </section>
            <section class="taskSection">
              <h3>Trabajos</h3>
              <div class="taskList" id="taskListWork"></div>
              <p class="emptyState" id="emptyWork">Sin trabajos en este rango.</p>
            </section>
          </div>
        </section>

        <section class="panel panelTop ticketsPanel">
          <div class="panelHeader">
            <h2>Necesita profesor</h2>
            <span class="panelHint">Tickets abiertos</span>
          </div>
          <ul class="ticketList" id="ticketList"></ul>
          <p class="emptyState" id="ticketEmpty">No hay tickets abiertos.</p>
        </section>

        <section class="panel notebookPanel">
          <div class="panelHeader">
            <div>
              <h2>Cuaderno</h2>
              <span class="panelHint">Registro del curso</span>
            </div>
            <div class="notebookLegend">
              <span class="legendItem"><span class="legendDot ok"></span>Ok</span>
              <span class="legendItem"><span class="legendDot pending"></span>Pendiente</span>
              <span class="legendItem"><span class="legendDot needs"></span>Necesita profesor</span>
            </div>
          </div>
          <div class="notebookTable" id="notebookTable"></div>
        </section>
      </section>
    </main>

    <div class="modalOverlay" id="studentModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2>Nuevo alumno</h2>
          <button class="iconBtn" data-close="studentModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form id="studentForm">
          <div class="formGrid">
            <div class="formField">
              <label for="studentName">Nombre</label>
              <input id="studentName" name="name" type="text" placeholder="Ej. Ana" required>
            </div>
            <div class="formField">
              <label for="studentSurname">Apellidos</label>
              <input id="studentSurname" name="surname" type="text" placeholder="Ej. López García" required>
            </div>
            <div class="formField">
              <label for="studentGroup">Grupo</label>
              <div class="groupFixed" id="studentGroupLabel" aria-live="polite"></div>
              <input id="studentGroup" name="groupId" type="hidden" required>
            </div>
          </div>
          <div class="modalActions">
            <button class="btn ghost" data-close="studentModal" type="button">Cancelar</button>
            <button class="btn primary" type="submit">Guardar alumno</button>
          </div>
        </form>
      </div>
    </div>

    <div class="modalOverlay" id="taskModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2>Nueva tarea</h2>
          <button class="iconBtn" data-close="taskModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form id="taskForm">
          <div class="formGrid">
            <div class="formField">
              <label for="taskType">Tipo</label>
              <select id="taskType" name="type" required>
                <option value="homework">Deberes</option>
                <option value="exam">Exámenes</option>
                <option value="work">Trabajos</option>
              </select>
            </div>
            <div class="formField">
              <label for="taskTitle">Título</label>
              <input id="taskTitle" name="title" type="text" placeholder="Ej. Lectura capítulo 3" required>
            </div>
            <div class="formField">
              <label for="taskDate">Fecha de entrega</label>
              <input id="taskDate" name="dueDate" type="date" required>
            </div>
            <div class="formField">
              <label for="taskGroup">Grupo</label>
              <div class="groupFixed" id="taskGroupLabel" aria-live="polite"></div>
              <input id="taskGroup" name="groupId" type="hidden" required>
            </div>
          </div>
        <div class="formField taskNotes">
          <label for="taskDesc">Descripción (opcional)</label>
          <textarea id="taskDesc" name="desc" rows="3" placeholder="Notas para el grupo"></textarea>
        </div>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
            <button class="btn ghost" id="taskAddFileBtn" type="button">Añadir archivo</button>
          </div>
          <input id="taskFileInput" type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" hidden>
          <ul class="attachmentList" id="taskAttachmentList"></ul>
          <p class="hint" id="taskAttachmentEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn ghost" data-close="taskModal" type="button">Cancelar</button>
          <button class="btn primary" type="submit">Guardar tarea</button>
        </div>
      </form>
      </div>
    </div>

    <div class="modalOverlay" id="ticketModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2 id="ticketTitle">Ticket</h2>
          <button class="iconBtn" data-close="ticketModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="ticketDetail" id="ticketDetail"></div>
        <div class="modalActions">
          <button class="btn ghost" data-close="ticketModal" type="button">Cerrar</button>
          <button class="btn primary" id="ticketResolveBtn" type="button">Marcar resuelto</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="taskDetailModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2 id="taskDetailTitle">Tarea</h2>
          <button class="iconBtn" data-close="taskDetailModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="ticketDetail" id="taskDetailBody"></div>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
          </div>
          <ul class="attachmentList" id="taskDetailAttachments"></ul>
          <p class="hint" id="taskDetailEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn ghost" data-close="taskDetailModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

function cacheDashboardElements() {
  elements = {
    groupSelect: document.getElementById("groupSelect"),
    taskGroupLabel: document.getElementById("taskGroupLabel"),
    themeToggle: document.getElementById("themeToggle"),
    studentList: document.getElementById("studentList"),
    studentEmpty: document.getElementById("studentEmpty"),
    addStudentBtn: document.getElementById("addStudentBtn"),
    studentOrder: document.getElementById("studentOrder"),
    studentModal: document.getElementById("studentModal"),
    studentForm: document.getElementById("studentForm"),
    studentName: document.getElementById("studentName"),
    studentSurname: document.getElementById("studentSurname"),
    studentGroup: document.getElementById("studentGroup"),
    studentGroupLabel: document.getElementById("studentGroupLabel"),
    ticketList: document.getElementById("ticketList"),
    ticketEmpty: document.getElementById("ticketEmpty"),
    tabs: document.querySelectorAll(".tabBtn"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    tasksPanel: document.querySelector(".tasksPanel"),
    taskListHomework: document.getElementById("taskListHomework"),
    taskListExam: document.getElementById("taskListExam"),
    taskListWork: document.getElementById("taskListWork"),
    emptyHomework: document.getElementById("emptyHomework"),
    emptyExam: document.getElementById("emptyExam"),
    emptyWork: document.getElementById("emptyWork"),
    logoutBtn: document.getElementById("logoutBtn"),
    taskModal: document.getElementById("taskModal"),
    taskForm: document.getElementById("taskForm"),
    taskType: document.getElementById("taskType"),
    taskTitle: document.getElementById("taskTitle"),
    taskDate: document.getElementById("taskDate"),
    taskGroup: document.getElementById("taskGroup"),
    taskDesc: document.getElementById("taskDesc"),
    taskAddFileBtn: document.getElementById("taskAddFileBtn"),
    taskFileInput: document.getElementById("taskFileInput"),
    taskAttachmentList: document.getElementById("taskAttachmentList"),
    taskAttachmentEmpty: document.getElementById("taskAttachmentEmpty"),
    ticketModal: document.getElementById("ticketModal"),
    ticketTitle: document.getElementById("ticketTitle"),
    ticketDetail: document.getElementById("ticketDetail"),
    ticketResolveBtn: document.getElementById("ticketResolveBtn"),
    taskDetailModal: document.getElementById("taskDetailModal"),
    taskDetailTitle: document.getElementById("taskDetailTitle"),
    taskDetailBody: document.getElementById("taskDetailBody"),
    taskDetailAttachments: document.getElementById("taskDetailAttachments"),
    taskDetailEmpty: document.getElementById("taskDetailEmpty"),
    notebookTable: document.getElementById("notebookTable")
  };
}

function cacheLoginElements() {
  elements = {
    accessCode: document.getElementById("accessCode"),
    accessBtn: document.getElementById("accessBtn")
  };
}

function getCurrentGroup() {
  return state.data.groups.find(group => group.id === state.currentGroupId) || state.data.groups[0];
}

function renderGroups() {
  if (!elements.groupSelect || !elements.taskGroup) return;

  elements.groupSelect.innerHTML = "";

  state.data.groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    elements.groupSelect.appendChild(option.cloneNode(true));
  });

  elements.groupSelect.value = state.currentGroupId;
  elements.taskGroup.value = state.currentGroupId;
  if (elements.studentGroup) {
    elements.studentGroup.value = state.currentGroupId;
  }

  if (elements.taskGroupLabel) {
    const group = getCurrentGroup();
    elements.taskGroupLabel.textContent = group ? group.name : "Grupo";
  }

  if (elements.studentGroupLabel) {
    const group = getCurrentGroup();
    elements.studentGroupLabel.textContent = group ? group.name : "Grupo";
  }
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: name || "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function normalizeStudent(student) {
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

function formatStudentName(student) {
  if (!student) return "";
  const first = student.firstName || "";
  const last = student.lastName || "";
  if (!last) return student.name || first;
  return `${last}, ${first}`.trim();
}

function compareBySurname(a, b) {
  const aLast = (a.lastName || "").toString();
  const bLast = (b.lastName || "").toString();
  const lastCompare = aLast.localeCompare(bLast, "es-ES", { sensitivity: "base" });
  if (lastCompare !== 0) return lastCompare;
  const aFirst = (a.firstName || "").toString();
  const bFirst = (b.firstName || "").toString();
  return aFirst.localeCompare(bFirst, "es-ES", { sensitivity: "base" });
}

function renderStudents() {
  const groupId = state.currentGroupId;
  const students = state.data.students
    .filter(student => student.groupId === groupId)
    .map(student => normalizeStudent(student));

  elements.studentList.innerHTML = "";

  if (state.studentOrder === "surname") {
    const ordered = [...students].sort(compareBySurname);
    ordered.forEach(student => {
      elements.studentList.appendChild(renderStudentItem(student));
    });
  } else {
    STATUS_ORDER.forEach(statusKey => {
      const group = students.filter(student => student.status === statusKey).sort(compareBySurname);
      if (!group.length) return;
      const section = document.createElement("div");
      section.className = "studentGroup";
      section.dataset.group = statusKey;
      const header = document.createElement("div");
      header.className = "studentGroupHeader";
      header.innerHTML = `
        <button class="studentGroupToggle" type="button" data-group="${statusKey}">
          <span>${STATUS_CONFIG[statusKey].label} (${group.length})</span>
          <span class="toggleIcon">${state.studentGroupOpen === statusKey ? "−" : "+"}</span>
        </button>
      `;
      section.appendChild(header);
      const content = document.createElement("div");
      content.className = "studentGroupBody";
      if (state.studentGroupOpen !== statusKey) {
        content.setAttribute("hidden", "hidden");
        content.style.display = "none";
      } else {
        content.removeAttribute("hidden");
        content.style.display = "flex";
      }
      group.forEach(student => {
        content.appendChild(renderStudentItem(student));
      });
      section.appendChild(content);
      elements.studentList.appendChild(section);
    });
  }

  elements.studentEmpty.style.display = students.length ? "none" : "block";
}

function renderStudentItem(student) {
  const status = STATUS_CONFIG[student.status] || STATUS_CONFIG.pending;
  const item = document.createElement("div");
  item.className = "studentItem";
  item.innerHTML = `
    <div class="studentInfo">
      <span class="statusDot">${status.emoji}</span>
      <div>
        <div class="studentName">${formatStudentName(student)}</div>
        <div class="studentMeta">${status.label}</div>
      </div>
    </div>
    <select class="statusSelect" data-student-id="${student.id}">
      <option value="pending">Pendiente</option>
      <option value="submitted">Ok</option>
      <option value="needs_teacher">Necesita profesor</option>
    </select>
  `;
  const select = item.querySelector("select");
  select.value = student.status;
  return item;
}

function filterTasks() {
  const groupId = state.currentGroupId;
  const today = new Date();
  const start = parseDate(formatDate(today));
  let end = start;

  if (state.range === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end = new Date(start);
  } else if (state.range === "week") {
    end = addDays(start, 6);
  }

  return state.data.tasks.filter(task => {
    if (task.groupId !== groupId) return false;
    const due = parseDate(task.dueDate);
    return due >= start && due <= end;
  });
}

function taskMeta(task) {
  const group = state.data.groups.find(g => g.id === task.groupId);
  const due = parseDate(task.dueDate);
  const label = due.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  return `${label} · ${group ? group.name : "Grupo"}`;
}

function renderPlanner() {
  const tasks = filterTasks();
  const sections = {
    homework: [],
    exam: [],
    work: []
  };

  tasks.forEach(task => {
    if (sections[task.type]) sections[task.type].push(task);
  });

  Object.keys(sections).forEach(type => {
    sections[type].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  });

  renderTaskList(elements.taskListHomework, sections.homework);
  renderTaskList(elements.taskListExam, sections.exam);
  renderTaskList(elements.taskListWork, sections.work);

  elements.emptyHomework.style.display = sections.homework.length ? "none" : "block";
  elements.emptyExam.style.display = sections.exam.length ? "none" : "block";
  elements.emptyWork.style.display = sections.work.length ? "none" : "block";
}

function renderTaskList(container, tasks) {
  container.innerHTML = "";
  tasks.forEach(task => {
    const attachmentCount = (task.attachments || []).length;
    const item = document.createElement("div");
    item.className = "taskItem";
    item.dataset.taskId = task.id;
    item.innerHTML = `
      <button class="taskDeleteBtn" data-task-id="${task.id}" type="button" aria-label="Eliminar tarea">✕</button>
      <div class="taskTitle">${task.title}</div>
      <div class="taskMeta">${taskMeta(task)}</div>
      ${attachmentCount ? `<span class="taskChip">📎 ${attachmentCount} adjunto${attachmentCount === 1 ? "" : "s"}</span>` : ""}
      ${task.desc ? `<div class="taskMeta">${task.desc}</div>` : ""}
    `;
    container.appendChild(item);
  });
}

function renderPendingAttachments() {
  if (!elements.taskAttachmentList) return;
  elements.taskAttachmentList.innerHTML = "";
  pendingAttachments.forEach(item => {
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="attachmentInfo">
        <div class="attachmentName">${item.file.name}</div>
        <div class="attachmentMeta">${formatFileSize(item.file.size)}</div>
      </div>
      <button class="btn ghost" data-attachment-id="${item.id}" type="button">Quitar</button>
    `;
    elements.taskAttachmentList.appendChild(li);
  });
  elements.taskAttachmentEmpty.style.display = pendingAttachments.length ? "none" : "block";
}

function renderTickets() {
  const groupId = state.currentGroupId;
  const openTickets = state.data.tickets.filter(ticket => ticket.status === "open" && ticket.groupId === groupId);

  elements.ticketList.innerHTML = "";

  openTickets.forEach(ticket => {
    const student = normalizeStudent(state.data.students.find(item => item.id === ticket.studentId));
    const item = document.createElement("li");
    item.className = "ticketItem";
    item.innerHTML = `
      <div class="ticketInfo">
        <div class="ticketTitle">${ticket.title}</div>
        <div class="ticketMeta">${student ? formatStudentName(student) : "Alumno"} · ${ticket.createdAt}</div>
      </div>
      <div class="ticketActions">
        <button class="btn ghost" data-action="open" data-ticket-id="${ticket.id}">Abrir</button>
        <button class="btn primary" data-action="resolve" data-ticket-id="${ticket.id}">Marcar resuelto</button>
      </div>
    `;
    elements.ticketList.appendChild(item);
  });

  elements.ticketEmpty.style.display = openTickets.length ? "none" : "block";
}

function getNotebookEntry(studentId) {
  if (!state.data.notebook || typeof state.data.notebook !== "object") {
    state.data.notebook = {};
  }
  if (!state.data.notebook[studentId]) {
    state.data.notebook[studentId] = {
      grade: "",
      note: "",
      marks: { s1: "", s2: "", s3: "", s4: "" }
    };
  }
  return state.data.notebook[studentId];
}

function renderNotebook() {
  if (!elements.notebookTable) return;
  const groupId = state.currentGroupId;
  const students = state.data.students
    .filter(student => student.groupId === groupId)
    .map(student => normalizeStudent(student))
    .sort(compareBySurname);

  elements.notebookTable.innerHTML = "";

  const header = document.createElement("div");
  header.className = "notebookRow notebookHeader";
  header.innerHTML = `
    <div class="notebookCell">Alumno</div>
    <div class="notebookCell center">Nota</div>
    <div class="notebookCell">Observaciones</div>
    <div class="notebookCell center">S1</div>
    <div class="notebookCell center">S2</div>
    <div class="notebookCell center">S3</div>
    <div class="notebookCell center">S4</div>
  `;
  elements.notebookTable.appendChild(header);

  students.forEach(student => {
    const entry = getNotebookEntry(student.id);
    const row = document.createElement("div");
    row.className = "notebookRow";
    row.dataset.studentId = student.id;
    row.innerHTML = `
      <div class="notebookCell notebookName">${formatStudentName(student)}</div>
      <div class="notebookCell center">
        <input class="notebookInput" data-field="grade" type="text" value="${entry.grade || ""}" placeholder="—">
      </div>
      <div class="notebookCell">
        <input class="notebookInput wide" data-field="note" type="text" value="${entry.note || ""}" placeholder="Notas rápidas">
      </div>
      ${renderNotebookMark("s1", entry.marks?.s1)}
      ${renderNotebookMark("s2", entry.marks?.s2)}
      ${renderNotebookMark("s3", entry.marks?.s3)}
      ${renderNotebookMark("s4", entry.marks?.s4)}
    `;
    elements.notebookTable.appendChild(row);
  });
}

function renderNotebookMark(key, value) {
  const options = [
    { value: "", label: "—" },
    { value: "submitted", label: "Ok" },
    { value: "pending", label: "Pend." },
    { value: "needs_teacher", label: "Necesita" }
  ];
  const optionHtml = options
    .map(opt => `<option value="${opt.value}" ${opt.value === value ? "selected" : ""}>${opt.label}</option>`)
    .join("");
  return `
    <div class="notebookCell center">
      <select class="notebookSelect" data-field="mark-${key}">
        ${optionHtml}
      </select>
    </div>
  `;
}

function renderAll() {
  renderGroups();
  renderStudents();
  renderPlanner();
  renderTickets();
  renderNotebook();
}

function setRange(range) {
  state.range = range;
  elements.tabs.forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.range === range);
  });
  renderPlanner();
}

function openTaskModal() {
  elements.taskForm.reset();
  pendingAttachments = [];
  renderPendingAttachments();
  elements.taskGroup.value = state.currentGroupId;
  setOverlay(elements.taskModal, true);
}

function closeTaskModal() {
  setOverlay(elements.taskModal, false);
}

function openStudentModal() {
  elements.studentForm.reset();
  elements.studentGroup.value = state.currentGroupId;
  if (elements.studentGroupLabel) {
    const group = getCurrentGroup();
    elements.studentGroupLabel.textContent = group ? group.name : "Grupo";
  }
  setOverlay(elements.studentModal, true);
}

function closeStudentModal() {
  setOverlay(elements.studentModal, false);
}

function openTicketModal(ticketId) {
  const ticket = state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;

  const student = normalizeStudent(state.data.students.find(item => item.id === ticket.studentId));
  const group = state.data.groups.find(item => item.id === ticket.groupId);
  elements.ticketTitle.textContent = ticket.title;
  elements.ticketDetail.innerHTML = `
    <div><strong>Alumno:</strong> ${student ? formatStudentName(student) : "-"}</div>
    <div><strong>Grupo:</strong> ${group ? group.name : "-"}</div>
    <div><strong>Fecha:</strong> ${ticket.createdAt}</div>
    <div><strong>Detalle:</strong></div>
    <div>${ticket.detail}</div>
  `;
  state.activeTicketId = ticketId;
  setOverlay(elements.ticketModal, true);
}

function closeTicketModal() {
  setOverlay(elements.ticketModal, false);
  state.activeTicketId = null;
}

function openTaskDetailModal(taskId) {
  const task = state.data.tasks.find(item => item.id === taskId);
  if (!task) return;
  const group = state.data.groups.find(item => item.id === task.groupId);
  elements.taskDetailTitle.textContent = task.title;
  elements.taskDetailBody.innerHTML = `
    <div><strong>Tipo:</strong> ${TYPE_LABELS[task.type] || "Tarea"}</div>
    <div><strong>Grupo:</strong> ${group ? group.name : "-"}</div>
    <div><strong>Entrega:</strong> ${task.dueDate}</div>
    ${task.desc ? `<div><strong>Descripción:</strong></div><div>${task.desc}</div>` : ""}
  `;
  renderTaskDetailAttachments(task.attachments || []);
  state.activeTaskId = taskId;
  setOverlay(elements.taskDetailModal, true);
}

function closeTaskDetailModal() {
  setOverlay(elements.taskDetailModal, false);
  state.activeTaskId = null;
}

function renderTaskDetailAttachments(attachments) {
  elements.taskDetailAttachments.innerHTML = "";
  attachments.forEach(file => {
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="attachmentInfo">
        <div class="attachmentName">${file.name}</div>
        <div class="attachmentMeta">${formatFileSize(file.size)}</div>
      </div>
      <div class="attachmentActions">
        <button class="btn primary" data-file-action="remove" data-file-id="${file.id}" type="button">Quitar</button>
      </div>
    `;
    elements.taskDetailAttachments.appendChild(li);
  });
  elements.taskDetailEmpty.style.display = attachments.length ? "none" : "block";
}

function resolveTicket(ticketId) {
  const ticket = state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;
  ticket.status = "resolved";
  const student = state.data.students.find(item => item.id === ticket.studentId);
  if (student && student.status === "needs_teacher") {
    student.status = "pending";
  }
  saveData();
  renderTickets();
}

function handleNotebookInput(event) {
  const target = event.target;
  if (!target || !target.dataset.field) return;
  const row = target.closest(".notebookRow");
  if (!row || !row.dataset.studentId) return;
  const entry = getNotebookEntry(row.dataset.studentId);
  const field = target.dataset.field;
  if (field.startsWith("mark-")) {
    const key = field.replace("mark-", "");
    entry.marks[key] = target.value;
  } else if (field === "grade") {
    entry.grade = target.value.trim();
  } else if (field === "note") {
    entry.note = target.value.trim();
  }
  saveData();
}

function handleStudentStatusChange(event) {
  const select = event.target.closest(".statusSelect");
  if (!select) return;
  const student = state.data.students.find(item => item.id === select.dataset.studentId);
  if (!student) return;
  student.status = select.value;
  const groupId = student.groupId;
  if (student.status === "needs_teacher") {
    const hasOpen = state.data.tickets.some(ticket => (
      ticket.studentId === student.id &&
      ticket.groupId === groupId &&
      ticket.status === "open"
    ));
    if (!hasOpen) {
      state.data.tickets.push({
        id: `k${Date.now()}`,
        title: `Necesita profesor · ${student.firstName || student.name}`,
        detail: "Marcado desde alumnos.",
        studentId: student.id,
        groupId,
        status: "open",
        createdAt: formatDate(new Date())
      });
    }
  } else {
    state.data.tickets.forEach(ticket => {
      if (ticket.studentId === student.id && ticket.groupId === groupId && ticket.status === "open") {
        ticket.status = "resolved";
      }
    });
  }
  saveData();
  renderStudents();
  renderTickets();
}

function handleTicketActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const ticketId = button.dataset.ticketId;
  if (button.dataset.action === "open") {
    openTicketModal(ticketId);
  }
  if (button.dataset.action === "resolve") {
    resolveTicket(ticketId);
  }
}

async function deleteTaskById(taskId) {
  const taskIndex = state.data.tasks.findIndex(task => task.id === taskId);
  if (taskIndex === -1) return;

  const task = state.data.tasks[taskIndex];
  const attachments = task.attachments || [];
  for (const attachment of attachments) {
    try {
      await deleteFile(attachment.id);
    } catch (error) {
      console.warn("No se pudo borrar adjunto:", error);
    }
  }

  state.data.tasks.splice(taskIndex, 1);
  if (state.data.taskStatus && typeof state.data.taskStatus === "object") {
    delete state.data.taskStatus[taskId];
  }

  saveData();
  renderPlanner();
}

function handleTaskDelete(event) {
  const button = event.target.closest(".taskDeleteBtn");
  if (!button) return false;
  const taskId = button.dataset.taskId;
  if (!taskId) return true;
  const ok = confirm("¿Eliminar esta tarea?");
  if (!ok) return true;
  deleteTaskById(taskId);
  return true;
}

function generateId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function handleAttachmentInput(event) {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    pendingAttachments.push({ id: generateId(), file });
  });
  event.target.value = "";
  renderPendingAttachments();
}

function handleAttachmentRemove(event) {
  const button = event.target.closest("button[data-attachment-id]");
  if (!button) return;
  const id = button.dataset.attachmentId;
  pendingAttachments = pendingAttachments.filter(item => item.id !== id);
  renderPendingAttachments();
}

async function handleAttachmentAction(event) {
  const button = event.target.closest("button[data-file-action]");
  if (!button) return;
  const id = button.dataset.fileId;
  const action = button.dataset.fileAction;
  try {
    if (action === "remove") {
      const task = state.data.tasks.find(item => item.id === state.activeTaskId);
      if (!task) return;
      task.attachments = (task.attachments || []).filter(file => file.id !== id);
      try {
        await deleteFile(id);
      } catch (error) {
        console.warn("No se pudo borrar adjunto:", error);
      }
      saveData();
      renderTaskDetailAttachments(task.attachments || []);
      return;
    }
    const record = await getFile(id);
    if (!record || !record.blob) return;
    const url = URL.createObjectURL(record.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = record.name || "adjunto";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.warn("No se pudo abrir el adjunto:", error);
  }
}

function refreshData() {
  state.data = loadData();
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const type = elements.taskType.value;
  const title = elements.taskTitle.value.trim();
  const dueDate = elements.taskDate.value;
  const desc = elements.taskDesc.value.trim();
  const groupId = elements.taskGroup.value;

  if (!title || !dueDate || !groupId) return;

  const attachments = [];
  for (const item of pendingAttachments) {
    try {
      await putFile({
        id: item.id,
        name: item.file.name,
        type: item.file.type,
        size: item.file.size,
        blob: item.file
      });
      attachments.push({
        id: item.id,
        name: item.file.name,
        type: item.file.type,
        size: item.file.size
      });
    } catch (error) {
      console.warn("No se pudo guardar adjunto:", error);
    }
  }

  state.data.tasks.push({
    id: `t${Date.now()}`,
    type,
    title,
    dueDate,
    desc,
    groupId,
    attachments,
    createdAt: Date.now()
  });

  saveData();
  closeTaskModal();
  refreshData();
  renderPlanner();
  renderTickets();
  renderStudents();
}

function handleStudentSubmit(event) {
  event.preventDefault();
  const name = elements.studentName.value.trim();
  const surname = elements.studentSurname.value.trim();
  const groupId = elements.studentGroup.value;
  if (!name || !surname || !groupId) return;

  state.data.students.push({
    id: `s${Date.now()}`,
    firstName: name,
    lastName: surname,
    name: `${name} ${surname}`.trim(),
    groupId,
    status: "pending"
  });

  saveData();
  closeStudentModal();
  refreshData();
  renderStudents();
  renderTickets();
}

function initDashboardEvents() {
  if (elements.themeToggle) {
    updateThemeToggleLabel(elements.themeToggle);
    elements.themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || getSystemTheme() || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      updateThemeToggleLabel(elements.themeToggle);
    });
  }

  elements.groupSelect?.addEventListener("change", event => {
    state.currentGroupId = event.target.value;
    localStorage.setItem(GROUP_KEY, state.currentGroupId);
    renderAll();
  });

  elements.studentOrder?.addEventListener("change", event => {
    state.studentOrder = event.target.value;
    localStorage.setItem(STUDENT_ORDER_KEY, state.studentOrder);
    renderStudents();
  });

  elements.studentList?.addEventListener("change", handleStudentStatusChange);
  elements.studentList?.addEventListener("click", event => {
    const button = event.target.closest(".studentGroupToggle");
    if (!button) return;
    const group = button.dataset.group;
    if (!group) return;
    state.studentGroupOpen = group;
    renderStudents();
  });
  elements.ticketList?.addEventListener("click", handleTicketActions);

  elements.tabs.forEach(tab => {
    tab.addEventListener("click", () => setRange(tab.dataset.range));
  });

  elements.addTaskBtn?.addEventListener("click", openTaskModal);
  elements.addStudentBtn?.addEventListener("click", openStudentModal);
  elements.taskForm?.addEventListener("submit", handleTaskSubmit);
  elements.studentForm?.addEventListener("submit", handleStudentSubmit);
  elements.taskAddFileBtn?.addEventListener("click", () => elements.taskFileInput?.click());
  elements.taskFileInput?.addEventListener("change", handleAttachmentInput);
  elements.taskAttachmentList?.addEventListener("click", handleAttachmentRemove);
  elements.tasksPanel?.addEventListener("click", event => {
    if (handleTaskDelete(event)) return;
    const item = event.target.closest(".taskItem");
    if (!item || !item.dataset.taskId) return;
    openTaskDetailModal(item.dataset.taskId);
  });
  elements.taskDetailAttachments?.addEventListener("click", handleAttachmentAction);
  elements.notebookTable?.addEventListener("input", handleNotebookInput);
  elements.notebookTable?.addEventListener("change", handleNotebookInput);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.close;
      if (target === "taskModal") closeTaskModal();
      if (target === "studentModal") closeStudentModal();
      if (target === "ticketModal") closeTicketModal();
      if (target === "taskDetailModal") closeTaskDetailModal();
    });
  });

  elements.taskModal?.addEventListener("click", event => {
    if (event.target === elements.taskModal) closeTaskModal();
  });

  elements.studentModal?.addEventListener("click", event => {
    if (event.target === elements.studentModal) closeStudentModal();
  });

  elements.ticketModal?.addEventListener("click", event => {
    if (event.target === elements.ticketModal) closeTicketModal();
  });

  elements.taskDetailModal?.addEventListener("click", event => {
    if (event.target === elements.taskDetailModal) closeTaskDetailModal();
  });

  elements.logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(ACCESS_KEY);
    renderLoginView();
  });

  elements.ticketResolveBtn?.addEventListener("click", () => {
    if (!state.activeTicketId) return;
    resolveTicket(state.activeTicketId);
    closeTicketModal();
  });
}

function initLoginEvents() {
  elements.accessBtn?.addEventListener("click", () => {
    const code = normalizeCode(elements.accessCode.value);
    if (code === "lyceo" || code === "liceo") {
      localStorage.setItem(ACCESS_KEY, "1");
      elements.accessCode.value = "";
      renderDashboard();
    } else {
      elements.accessCode.focus();
    }
  });

  elements.accessCode?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      elements.accessBtn.click();
    }
  });
}

function renderLoginView() {
  appRoot.innerHTML = getLoginTemplate();
  cacheLoginElements();
  initLoginEvents();
  elements.accessCode?.focus();
}

function renderDashboard() {
  appRoot.innerHTML = getDashboardTemplate();
  cacheDashboardElements();
  if (elements.studentOrder) {
    elements.studentOrder.value = state.studentOrder || "status";
  }
  renderAll();
  initDashboardEvents();
}

function init() {
  const savedTheme = getSavedTheme();
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme(getSystemTheme() || "dark");
  }

  state.data = loadData();
  state.currentGroupId = localStorage.getItem(GROUP_KEY) || state.data.groups[0]?.id;
  state.studentOrder = localStorage.getItem(STUDENT_ORDER_KEY) || "status";
  if (hasAccess()) {
    renderDashboard();
  } else {
    renderLoginView();
  }
}

init();
