import { fetchNombresDeProfesores } from "../academiaSustituciones/consultas.js";

// Traduce sustitucionPorAlumnoId (ver resolverAlumnosVisibles.js — solo
// ids, es una decisión de seguridad, no de presentación) a un
// Map<alumnoId, { sustituido_nombre }> con el nombre ya resuelto, para
// que horario/diario lo adjunten a cada franja/entrada sin repetir esta
// consulta en los dos route files. `sustituido_nombre` en snake_case
// para reutilizar el mismo nombre de campo que ya usan
// fetchMisSustitucionesActivas/en_sustitucion_de (ver derivarAutoria.js)
// en vez de inventar uno nuevo para el mismo dato.
export async function resolverBadgesSustitucion(admin, sustitucionPorAlumnoId) {
  const badges = new Map();
  if (!sustitucionPorAlumnoId) return badges;

  const profesorIds = [...new Set(Object.values(sustitucionPorAlumnoId))];
  const nombresPorProfesorId = await fetchNombresDeProfesores(admin, profesorIds);

  for (const [alumnoId, profesorSustituidoId] of Object.entries(sustitucionPorAlumnoId)) {
    badges.set(alumnoId, {
      sustituido_nombre: nombresPorProfesorId.get(profesorSustituidoId) || null,
    });
  }
  return badges;
}
