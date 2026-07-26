// Alta y revocación de sustituciones (migración 097). Gestión exclusiva
// del admin (ver sustituciones.routes.js, que exige roles:["admin"] en
// ambos endpoints) — este módulo no vuelve a decidir quién puede hacer
// qué, solo valida invariantes de datos.

// El EXCLUDE constraint de la migración 098 (academia_sustituciones_sin_solape)
// es la última línea de defensa real contra duplicados/solapes — la única
// que no se puede saltar por una llamada directa a la API o una condición
// de carrera entre dos peticiones simultáneas (a diferencia de las
// comprobaciones de arriba, que sí podrían perder esa carrera). 23P01 es
// el SQLSTATE de "exclusion_violation"; se comprueba también el nombre
// del constraint por si el código llega envuelto de otra forma, mismo
// criterio que isActiveUniqueInviteConflict (adminTeacherHelpers.js).
function esViolacionDeSolape(error) {
  if (!error) return false;
  if (String(error.code || "").trim() === "23P01") return true;
  const texto = [error.message, error.details, error.hint].filter(Boolean).join(" | ");
  return texto.includes("academia_sustituciones_sin_solape");
}

async function profesorPerteneceAlTenant(admin, tenantSlug, profesorId) {
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("id", profesorId)
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();
  return Boolean(data);
}

export async function crearSustitucion(admin, {
  tenantId, tenantSlug, profesorSustitutoId, profesorSustituidoId, fechaInicio, fechaFin, declaradaPor, origen,
}) {
  if (profesorSustitutoId === profesorSustituidoId) return { ok: false, code: "mismo_profesor" };
  if (fechaFin < fechaInicio) return { ok: false, code: "rango_invalido" };

  const [sustitutoOk, sustituidoOk] = await Promise.all([
    profesorPerteneceAlTenant(admin, tenantSlug, profesorSustitutoId),
    profesorPerteneceAlTenant(admin, tenantSlug, profesorSustituidoId),
  ]);
  if (!sustitutoOk || !sustituidoOk) return { ok: false, code: "profesor_not_found" };

  const { data, error } = await admin
    .from("academia_sustituciones")
    .insert({
      tenant_id: tenantId,
      profesor_sustituto_id: profesorSustitutoId,
      profesor_sustituido_id: profesorSustituidoId,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      declarada_por: declaradaPor,
      origen,
    })
    .select("id, profesor_sustituto_id, profesor_sustituido_id, fecha_inicio, fecha_fin, origen, created_at")
    .single();
  if (error) {
    if (esViolacionDeSolape(error)) return { ok: false, code: "solape" };
    return { ok: false, code: "crear_failed", error };
  }
  return { ok: true, sustitucion: data };
}

// Revocación = marcar, nunca DELETE (ver comentario de la migración): el
// rastro de qué se cubrió y cuándo se cerró importa para la auditoría —
// y para que derivarSustitucionParaRegistro.js siga pudiendo explicar
// registros pasados aunque la sustitución ya no esté vigente. Solo el
// admin llega aquí (la ruta exige roles:["admin"]), así que no hace
// falta ninguna comprobación de autoría — cualquier sustitución del
// tenant es revocable.
//
// Una sustitución ya finalizada (fecha_fin < hoy) no se puede revocar: su
// efecto ya ocurrió, revocarla no retira ningún acceso y solo ensucia el
// histórico marcando como revocado algo que sí llegó a pasar. `hoyISO`
// como parámetro explícito (no `new Date()` dentro), mismo criterio que
// fetchMisSustitucionesActivas/fetchProfesoresSustituidosHoy, para que
// los tests controlen la fecha.
export async function revocarSustitucion(admin, { tenantId, sustitucionId, revocadaPor, hoyISO }) {
  const { data: existente, error: findErr } = await admin
    .from("academia_sustituciones")
    .select("id, revocada_at, fecha_fin")
    .eq("id", sustitucionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (findErr) return { ok: false, code: "lookup_failed", error: findErr };
  if (!existente) return { ok: false, code: "not_found" };
  if (existente.revocada_at) return { ok: false, code: "ya_revocada" };
  if (existente.fecha_fin < hoyISO) return { ok: false, code: "finalizada" };

  const { error } = await admin
    .from("academia_sustituciones")
    .update({ revocada_at: new Date().toISOString(), revocada_por: revocadaPor })
    .eq("id", sustitucionId);
  if (error) return { ok: false, code: "revocar_failed", error };
  return { ok: true };
}
