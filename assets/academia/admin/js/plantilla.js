import { fetchProfesores } from "./apiProfesores.js";

// ¿El centro tiene un único profesor dando clase?
//
// De ahí depende que "Horario" salga en el menú (ver seccionesAdmin en
// sidebar.js): con un solo profesor, el cuadrante del centro y "mis clases"
// son la misma pantalla, y aparece dos veces en el menú.
//
// Se cuentan solo los ACTIVOS: un profesor dado de baja el curso pasado
// sigue en la lista para conservar su histórico, pero no imparte nada, y
// contarlo dejaría el menú duplicado para siempre en una academia de una
// sola persona que alguna vez tuvo a alguien.
export function esUnicoProfesor(profesores) {
  return (profesores || []).filter((p) => p?.is_active !== false).length <= 1;
}

// Ante un fallo de red se devuelve `false`, es decir: NO se esconde nada.
// Esconder una sección por un error de carga es mucho peor que enseñar una
// de más — el admin la busca, no la encuentra y cree que se ha perdido su
// horario.
export async function hayUnSoloProfesor({ fetchProfesoresFn = fetchProfesores } = {}) {
  try {
    return esUnicoProfesor(await fetchProfesoresFn());
  } catch {
    return false;
  }
}
