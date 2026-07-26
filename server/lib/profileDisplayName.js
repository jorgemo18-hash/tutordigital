// profiles.display_name NO está garantizado para un profesor: su nombre
// real vive en teacher_profiles.display_name (ensureProfileExists.js crea
// la fila de profiles sin nombre si en ese momento no hay ninguna fuente
// disponible — ver ese archivo para el porqué). Antes de este módulo, cada
// consumidor que necesitaba mostrar un nombre reimplementaba su propio
// fallback (mismo antipatrón que las 44 implementaciones locales de
// escHtml) — este archivo centraliza esa única lógica para que
// ensureProfileExists, academiaSustituciones/consultas.js y
// academiaFichajes/consultas.js compartan la misma fuente de verdad.

// Lookup en lote: para varios user_id, el nombre de teacher_profiles del
// tenant indicado (o de cualquier tenant si no se pasa tenantSlug — solo
// se usa así cuando quien llama no puede acotar por tenant, p.ej. un id
// suelto sin contexto de tenant todavía resuelto).
export async function fetchNombresDesdeTeacherProfiles(admin, tenantSlug, userIds) {
  if (!userIds.length) return new Map();
  let query = admin.from("teacher_profiles").select("user_id, display_name").in("user_id", userIds);
  if (tenantSlug) query = query.eq("tenant_slug", tenantSlug);
  const { data } = await query;
  const nombresPorId = new Map();
  for (const p of data || []) {
    if (p.display_name) nombresPorId.set(p.user_id, p.display_name);
  }
  return nombresPorId;
}

// Mismo lookup para un solo id — usado por ensureProfileExists al crear
// una fila nueva, donde solo hace falta resolver UN nombre.
export async function fetchNombreDesdeTeacherProfiles(admin, tenantSlug, userId) {
  const nombres = await fetchNombresDesdeTeacherProfiles(admin, tenantSlug, [userId]);
  return nombres.get(userId) || null;
}

// Resuelve display_name para varios ids de profiles, cayendo a
// teacher_profiles (mismo tenant) para los que profiles.display_name
// venga a NULL. Devuelve un Map<id, nombreONull> — quien llama decide qué
// mostrar si tampoco hay nada ahí (p.ej. "Sin nombre" o "—").
export async function fetchNombresDePerfilesConFallback(admin, tenantSlug, ids) {
  if (!ids.length) return new Map();
  const { data } = await admin.from("profiles").select("id, display_name").in("id", ids);
  const nombresPorId = new Map((data || []).map((p) => [p.id, p.display_name]));

  const sinNombre = ids.filter((id) => !nombresPorId.get(id));
  if (sinNombre.length) {
    const fallback = await fetchNombresDesdeTeacherProfiles(admin, tenantSlug, sinNombre);
    for (const [id, nombre] of fallback) {
      if (!nombresPorId.get(id)) nombresPorId.set(id, nombre);
    }
  }
  return nombresPorId;
}
