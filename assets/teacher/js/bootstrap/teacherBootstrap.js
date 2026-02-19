import { getTenantSlug } from "../../../shared/js/auth.js";

export function getTenant() {
  return getTenantSlug() || "";
}

export function applyTenantBranding(cfg) {
  if (!cfg) return;
  if (cfg.bgImage) {
    document.documentElement.style.setProperty("--bg-photo", `url("${cfg.bgImage}")`);
  }
}

export function updateTenantUI(elements, tenantCfg, state) {
  if (!elements) return;
  if (elements.tenantName) {
    elements.tenantName.textContent = tenantCfg?.name || "Centro";
  }
  if (elements.tenantPill) {
    const teacherName = state.currentTeacherName || state.currentTeacherId || "Profe";
    const groupName = state.data?.groups?.find(group => group.id === state.currentGroupId)?.name || "";
    const groupText = groupName ? ` · Grupo: ${groupName}` : "";
    const roleLabel = state.currentRole === "admin" ? "Admin" : "Docente";
    elements.tenantPill.textContent = `Centro: ${tenantCfg?.name || "Centro"} · Rol: ${roleLabel} · Profe: ${teacherName}${groupText}`;
  }
  if (elements.tenantLoginName) {
    elements.tenantLoginName.textContent = `Centro: ${tenantCfg?.name || "Centro"}`;
  }
}

export function updateTeacherSelect(elements, state) {
  if (!elements.teacherSelect) return;
  const teachers = state.data.teachers || [
    { id: "p1", name: "Profe A" },
    { id: "p2", name: "Profe B" }
  ];
  elements.teacherSelect.innerHTML = "";
  teachers.forEach(teacher => {
    const option = document.createElement("option");
    option.value = teacher.id;
    option.textContent = teacher.name || teacher.id;
    elements.teacherSelect.appendChild(option);
  });
  elements.teacherSelect.value = state.currentTeacherId || teachers[0]?.id || "p1";
  elements.teacherSelect.disabled = state.currentRole === "teacher";
}

export function setAdminPanelVisible(elements, visible) {
  if (!elements.teacherAdminPanel) return;
  elements.teacherAdminPanel.style.display = visible ? "" : "none";
}
