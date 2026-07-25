// Consultas de academia_sustituciones (migración 097). teacher_profiles se
// referencia dos veces desde esta tabla (sustituto y sustituido) — en vez
// de un embed con alias de PostgREST (frágil, depende del nombre exacto
// del FK), se resuelven los nombres en una segunda consulta y se
// combinan en JS, mismo criterio ya usado en fetchTrabajadoresDelTenant/
// fetchNombreTrabajador (academiaFichajes/consultas.js) para
// tenant_memberships↔profiles.
async function fetchNombresDeProfesores(admin, ids) {
  if (!ids.length) return new Map();
  const { data } = await admin.from("teacher_profiles").select("id, display_name").in("id", ids);
  return new Map((data || []).map((p) => [p.id, p.display_name]));
}

function conNombres(filas, nombresPorId) {
  return filas.map((f) => ({
    ...f,
    sustituto_nombre: nombresPorId.get(f.profesor_sustituto_id) || null,
    sustituido_nombre: nombresPorId.get(f.profesor_sustituido_id) || null,
  }));
}

// declarada_por/revocada_por referencian profiles(id), no teacher_profiles
// — un admin también puede declarar/revocar, y un admin no tiene fila en
// teacher_profiles. Consulta aparte por eso, mismo criterio que
// fetchNombresDeProfesores de arriba.
async function fetchNombresDePerfiles(admin, ids) {
  if (!ids.length) return new Map();
  const { data } = await admin.from("profiles").select("id, display_name").in("id", ids);
  return new Map((data || []).map((p) => [p.id, p.display_name]));
}

// Todas las sustituciones del tenant (activas e históricas, incluidas las
// revocadas) — vista del admin, más reciente primero. Incluye quién la
// declaró y quién la revocó (si aplica), resueltos a nombre.
export async function fetchSustitucionesDelTenant(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_sustituciones")
    .select(
      "id, profesor_sustituto_id, profesor_sustituido_id, fecha_inicio, fecha_fin, origen, " +
        "created_at, declarada_por, revocada_at, revocada_por"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) return { error };

  const filas = data || [];
  const profesorIds = [...new Set(filas.flatMap((f) => [f.profesor_sustituto_id, f.profesor_sustituido_id]))];
  const perfilIds = [...new Set(filas.flatMap((f) => [f.declarada_por, f.revocada_por]).filter(Boolean))];
  const [nombresPorId, nombresPerfilPorId] = await Promise.all([
    fetchNombresDeProfesores(admin, profesorIds),
    fetchNombresDePerfiles(admin, perfilIds),
  ]);
  return {
    sustituciones: conNombres(filas, nombresPorId).map((f) => ({
      ...f,
      declarada_por_nombre: nombresPerfilPorId.get(f.declarada_por) || null,
      revocada_por_nombre: f.revocada_por ? (nombresPerfilPorId.get(f.revocada_por) || null) : null,
    })),
  };
}

// Sustituciones ACTIVAS (no revocadas, hoy dentro del rango) donde este
// profesor participa, como sustituto o como sustituido — vista del
// profesor en su propio panel. `hoyISO` como parámetro explícito (no
// `new Date()` dentro) para que los tests controlen la fecha.
export async function fetchMisSustitucionesActivas(admin, { tenantId, profesorId, hoyISO }) {
  const { data, error } = await admin
    .from("academia_sustituciones")
    .select("id, profesor_sustituto_id, profesor_sustituido_id, fecha_inicio, fecha_fin, origen")
    .eq("tenant_id", tenantId)
    .is("revocada_at", null)
    .lte("fecha_inicio", hoyISO)
    .gte("fecha_fin", hoyISO)
    .or(`profesor_sustituto_id.eq.${profesorId},profesor_sustituido_id.eq.${profesorId}`);
  if (error) return { error };

  const filas = data || [];
  const profesorIds = [...new Set(filas.flatMap((f) => [f.profesor_sustituto_id, f.profesor_sustituido_id]))];
  const nombresPorId = await fetchNombresDeProfesores(admin, profesorIds);
  return {
    sustituciones: conNombres(filas, nombresPorId).map((f) => ({
      ...f,
      soy_sustituto: f.profesor_sustituto_id === profesorId,
    })),
  };
}

// Lista simple para el selector "¿a quién sustituyes?" (profesor panel)
// o "sustituto/sustituido" (admin) — deliberadamente propia en vez de
// reutilizar fetchTeacherProfiles (adminTeacherQueries.js): esa trae
// campos y una cadena de fallbacks pensada para el listado completo del
// admin de instituto+academia, que aquí no hace falta.
export async function fetchProfesoresParaSelector(admin, { tenantSlug, excluirProfesorId } = {}) {
  let query = admin
    .from("teacher_profiles")
    .select("id, display_name")
    .eq("tenant_slug", tenantSlug)
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (excluirProfesorId) query = query.neq("id", excluirProfesorId);
  const { data, error } = await query;
  if (error) return { error };
  return { profesores: data || [] };
}

// A quiénes sustituye HOY este profesor (no revocada, hoy dentro del
// rango) — lo único que necesita resolverAlumnoIdsVisibles() para
// ampliar qué alumnos ve. Deliberadamente no trae nombres ni más campos:
// es una consulta de visibilidad, no de presentación.
export async function fetchProfesoresSustituidosHoy(admin, { tenantId, profesorSustitutoId, hoyISO }) {
  const { data, error } = await admin
    .from("academia_sustituciones")
    .select("profesor_sustituido_id")
    .eq("tenant_id", tenantId)
    .eq("profesor_sustituto_id", profesorSustitutoId)
    .is("revocada_at", null)
    .lte("fecha_inicio", hoyISO)
    .gte("fecha_fin", hoyISO);
  if (error) return { error };
  return { profesorIds: [...new Set((data || []).map((r) => r.profesor_sustituido_id))] };
}
