// El estado de un alumno no es un booleano: son TRES estados, y se
// distinguen con DOS columnas.
//
//   activo    → activo = true
//   borrador  → activo = false, fecha_baja = null      (ficha a medias, aún no dada de alta)
//   archivado → activo = false, fecha_baja = <fecha>   (fue alumno y se le dio de baja)
//
// El listado filtraba solo por `activo`, así que la pestaña "Archivados"
// (activo=false) se llevaba TAMBIÉN los borradores: el mismo alumno salía a
// la vez en Borradores y en Archivados. Un borrador no se ha archivado —
// nunca ha llegado a estar de alta.
//
// La discriminante es `fecha_baja`, no una columna nueva: ya se rellena al
// archivar y se limpia al restaurar (ver academiaAlumnoHelpers.js), y es
// exactamente el criterio que fetchInscripcionesPendientes usaba para dejar
// fuera a los archivados. Aquí se escribe una sola vez, en positivo, para
// que los dos listados no puedan volver a discrepar.

export const ESTADOS = ["activo", "archivado", "borrador"];

// `activo` es el parámetro antiguo del endpoint. Se mantiene aceptado
// porque frontend y backend no se despliegan a la vez (Vercel / Render) y
// durante ese hueco puede llegar una petición de la versión anterior.
//
// activo=false se traduce a "archivado", no a "todo lo que no está activo":
// esa era justamente la lectura equivocada. Una versión vieja del panel que
// siga mandando activo=false verá lo correcto sin actualizarse.
export function resolverEstado({ estado, activo } = {}) {
  if (estado) return ESTADOS.includes(estado) ? estado : null;
  if (activo === "true") return "activo";
  if (activo === "false") return "archivado";
  return null; // sin filtro: todos los alumnos del centro
}

// Aplica el estado a una query de PostgREST ya construida (tabla, select y
// tenant incluidos). Recibe la query como parámetro en vez de crearla para
// no duplicar aquí la forma del listado, que vive en la ruta.
export function aplicarFiltroEstado(query, estado) {
  if (estado === "activo") return query.eq("activo", true);
  if (estado === "borrador") return query.eq("activo", false).is("fecha_baja", null);
  if (estado === "archivado") return query.eq("activo", false).not("fecha_baja", "is", null);
  return query;
}
