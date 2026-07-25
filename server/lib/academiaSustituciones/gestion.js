// Alta y revocación de sustituciones (migración 097). Las reglas de QUIÉN
// puede pedir qué rango de fechas (profesor: solo hoy; admin: cualquiera)
// viven en la ruta (necesitan el rol autenticado) — este módulo solo
// valida invariantes de datos que no dependen de quién pide la operación.
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
  if (error) return { ok: false, code: "crear_failed", error };
  return { ok: true, sustitucion: data };
}

// Revocación = marcar, nunca DELETE (ver comentario de la migración): el
// rastro de qué se cubrió y cuándo se cerró importa para la auditoría —
// y para que derivarSustitucionParaRegistro.js siga pudiendo explicar
// registros pasados aunque la sustitución ya no esté vigente.
export async function revocarSustitucion(admin, { tenantId, sustitucionId, revocadaPor }) {
  const { data: existente, error: findErr } = await admin
    .from("academia_sustituciones")
    .select("id, revocada_at")
    .eq("id", sustitucionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (findErr) return { ok: false, code: "lookup_failed", error: findErr };
  if (!existente) return { ok: false, code: "not_found" };
  if (existente.revocada_at) return { ok: false, code: "ya_revocada" };

  const { error } = await admin
    .from("academia_sustituciones")
    .update({ revocada_at: new Date().toISOString(), revocada_por: revocadaPor })
    .eq("id", sustitucionId);
  if (error) return { ok: false, code: "revocar_failed", error };
  return { ok: true };
}
