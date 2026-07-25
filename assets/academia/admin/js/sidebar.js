import { buildIcon } from "./icons.js";

// El SVG necesita la clase ac-sidebar-icon para heredar flex-shrink:0 (ver
// _academia-admin.css). Sin ella, al colapsar a 64px el flexbox encoge el
// icono junto con la etiqueta de texto (que solo se hace invisible por
// opacidad, pero sigue ocupando su ancho natural) y el icono desaparece.
function sidebarIcon(name, size = 16) {
  const icon = buildIcon(name, { size });
  icon.classList.add("ac-sidebar-icon");
  return icon;
}

export const SECTIONS = [
  { id: "alumnos", label: "Alumnos", icon: "users" },
  { id: "profesores", label: "Profesores", icon: "bookOpen" },
  { id: "sustituciones", label: "Sustituciones", icon: "swap" },
  { id: "lista_espera", label: "Lista de espera", icon: "clock" },
  { id: "documentos", label: "Documentos", icon: "fileText" },
  { id: "finanzas", label: "Finanzas", icon: "barChart" },
  { id: "envio_familias", label: "Envío a familias", icon: "send" },
];
// Aparte del array base: solo se añade si el tenant activó el control
// horario (Ajustes › Personal, ver academiaAdmin.js), a diferencia del
// resto que siempre están.
export const SECTION_FICHAJES = { id: "fichajes", label: "Control horario", icon: "clock" };
const SECTION_AJUSTES = { id: "ajustes", label: "Ajustes", icon: "sliders" };

function buildItem(section, onSelect) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-sidebar-item";
  btn.dataset.sectionId = section.id;
  btn.appendChild(sidebarIcon(section.icon));
  const label = document.createElement("span");
  label.textContent = section.label;
  btn.appendChild(label);
  btn.addEventListener("click", () => onSelect(section.id));
  return btn;
}

// Sidebar fijo, colapsa a 64px y expande a 196px al hover (puro CSS, ver
// .ac-sidebar en _academia-admin.css). `user`: {displayName, tenantName}.
export function buildSidebar({ activeId, sections = SECTIONS, onSelect, onThemeToggle, onLogout, user = {} }) {
  const wrap = document.createElement("nav");
  wrap.className = "ac-sidebar";

  const logo = document.createElement("div");
  logo.className = "ac-sidebar-logo";
  const mark = document.createElement("div");
  mark.className = "ac-sidebar-logo-mark";
  const logoText = document.createElement("span");
  logoText.className = "ac-sidebar-logo-text";
  logoText.textContent = "TutorDigital";
  logo.append(mark, logoText);
  wrap.appendChild(logo);

  const group = document.createElement("div");
  group.className = "ac-sidebar-group";
  const buttons = new Map();
  for (const section of sections) {
    const btn = buildItem(section, onSelect);
    group.appendChild(btn);
    buttons.set(section.id, btn);
  }
  wrap.appendChild(group);

  const bottom = document.createElement("div");
  bottom.className = "ac-sidebar-bottom";

  const sep1 = document.createElement("div");
  sep1.className = "ac-sidebar-sep";
  bottom.appendChild(sep1);

  const ajustesBtn = buildItem(SECTION_AJUSTES, onSelect);
  bottom.appendChild(ajustesBtn);
  buttons.set(SECTION_AJUSTES.id, ajustesBtn);

  const spacer = document.createElement("div");
  spacer.className = "ac-sidebar-spacer";
  bottom.appendChild(spacer);

  const sep2 = document.createElement("div");
  sep2.className = "ac-sidebar-sep";
  bottom.appendChild(sep2);

  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "ac-sidebar-item";
  bottom.appendChild(themeBtn);
  themeBtn.addEventListener("click", onThemeToggle);

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "ac-sidebar-item";
  logoutBtn.appendChild(sidebarIcon("logout"));
  const logoutLabel = document.createElement("span");
  logoutLabel.textContent = "Cerrar sesión";
  logoutBtn.appendChild(logoutLabel);
  logoutBtn.addEventListener("click", onLogout);
  bottom.appendChild(logoutBtn);

  const sep3 = document.createElement("div");
  sep3.className = "ac-sidebar-sep";
  bottom.appendChild(sep3);

  const userBox = document.createElement("div");
  userBox.className = "ac-sidebar-user";
  const userName = document.createElement("div");
  userName.className = "ac-sidebar-user-name";
  userName.textContent = user.displayName || "Admin";
  const userTenant = document.createElement("div");
  userTenant.className = "ac-sidebar-user-tenant";
  userTenant.textContent = user.tenantName || "Academia";
  userBox.append(userName, userTenant);
  bottom.appendChild(userBox);

  wrap.appendChild(bottom);

  function setActive(sectionId) {
    for (const [id, btn] of buttons) btn.classList.toggle("active", id === sectionId);
  }
  setActive(activeId);

  function setThemeLabel(theme) {
    themeBtn.innerHTML = "";
    const dark = theme !== "light";
    themeBtn.appendChild(sidebarIcon(dark ? "sun" : "moon"));
    const label = document.createElement("span");
    label.textContent = dark ? "Tema claro" : "Tema oscuro";
    themeBtn.appendChild(label);
  }

  return { wrap, setActive, setThemeLabel };
}
