// Iniciales del alumno para el avatar del chat — recibe el nombre
// explícito en vez de cerrar sobre ACTIVE_USER.
export function getStudentInitials(displayName) {
  const name = displayName || "";
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (parts[0]?.[0] || "?")).toUpperCase();
}
