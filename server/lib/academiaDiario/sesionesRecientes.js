// LO QUE SE HA TRABAJADO CON UN ALUMNO ÚLTIMAMENTE, para verlo al abrirlo en
// el Diario (Jorge, 1/10/2026: *"que se viera lo que hemos trabajado los
// últimos días, para tener una referencia visual, solo de las cinco últimas
// sesiones, materia y tema"*).
//
// Solo CLASES (las ausencias no dicen qué se trabajó) y solo ANTES del día
// que se está escribiendo: el parte de hoy ya está en el formulario.
// Materia y tema, nada más: el comentario de la sesión no se trae (puede
// llevar cosas que no hacen falta para ubicarse, y el privado aún menos).
export const LIMITE_SESIONES_RECIENTES = 5;

// Las asignaturas de una sesión: el formato nuevo (`asignaturas[]`, hasta 3
// bloques) o el par suelto `asignatura`/`tema` de las sesiones antiguas.
export function bloquesDeSesion(sesion) {
  const lista = Array.isArray(sesion.asignaturas) && sesion.asignaturas.length
    ? sesion.asignaturas
    : sesion.asignatura ? [{ nombre: sesion.asignatura, tema: sesion.tema }] : [];
  return lista
    .map((a) => ({ materia: String(a?.nombre || "").trim(), tema: String(a?.tema || "").trim() }))
    .filter((a) => a.materia);
}

export async function fetchSesionesRecientes(admin, { tenantId, alumnoId, antesDe, limite = LIMITE_SESIONES_RECIENTES }) {
  const { data, error } = await admin
    .from("academia_sesiones")
    .select("fecha, asignatura, tema, asignaturas")
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .eq("tipo", "clase")
    .lt("fecha", antesDe)
    .order("fecha", { ascending: false })
    .limit(limite);
  if (error) return { error };
  return {
    sesiones: (data || [])
      .map((s) => ({ fecha: s.fecha, bloques: bloquesDeSesion(s) }))
      .filter((s) => s.bloques.length),
  };
}
