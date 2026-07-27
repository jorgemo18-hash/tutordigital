// Etiqueta corta "Sustitución" para alumnos visibles hoy vía sustitución
// (nunca por asignación propia — ver resolverAlumnoIdsVisibles.js en el
// backend, que ya excluye a los propios de esta marca). Compartida entre
// horario.js (tarjetas del grid) y diarioCard.js (filas del diario) para
// no duplicar el marcado.
//
// A propósito un recurso visual DISTINTO del borde izquierdo de color
// (nivel educativo en horario.js/nivel.js, estado de sesión en
// diarioCard.js/.ac-card) — nunca reutiliza ese canal ni lo pisa.
export function buildBadgeSustitucion(viaSustitucion) {
  if (!viaSustitucion) return null;
  const badge = document.createElement("span");
  badge.className = "ac-badge-sustitucion";
  badge.textContent = "Sustitución";
  // El tooltip nombra a quién sustituye, para distinguir de quién viene
  // el alumno cuando el profesor cubre a varios colegas a la vez.
  badge.title = viaSustitucion.sustituido_nombre
    ? `Alumno de ${viaSustitucion.sustituido_nombre} — hoy lo cubres tú`
    : "Alumno de otro profesor — hoy lo cubres tú";
  return badge;
}
