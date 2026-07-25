// Decide los parámetros reales de creación de una sustitución según el
// rol de quien la pide — separado de la ruta (sin Fastify/DB) para poder
// testear la regla de negocio más sensible del sistema sin auth real:
// un profesor SOLO puede autodeclararse a sí mismo como sustituto, y
// SOLO para hoy. Cualquier otro rango u otro sustituto -> rechazado.
// El admin puede declarar cualquier rango, con cualquier profesor.
export function resolverParametrosCreacion({ role, miProfesorId, body, hoyISO }) {
  if (role === "teacher") {
    if (!miProfesorId) return { ok: false, code: "no_perfil_profesor" };
    // No son valores por defecto — son límites: si el cliente manda un
    // sustituto distinto de sí mismo, o un rango distinto de hoy, se
    // rechaza en vez de "corregirlo" en silencio.
    if (body.profesor_sustituto_id && body.profesor_sustituto_id !== miProfesorId) {
      return { ok: false, code: "solo_autodeclaracion" };
    }
    if ((body.fecha_inicio && body.fecha_inicio !== hoyISO) || (body.fecha_fin && body.fecha_fin !== hoyISO)) {
      return { ok: false, code: "solo_hoy" };
    }
    return { ok: true, profesorSustitutoId: miProfesorId, fechaInicio: hoyISO, fechaFin: hoyISO, origen: "autodeclarada" };
  }

  if (!body.profesor_sustituto_id || !body.fecha_inicio || !body.fecha_fin) {
    return { ok: false, code: "invalid_body" };
  }
  return {
    ok: true,
    profesorSustitutoId: body.profesor_sustituto_id,
    fechaInicio: body.fecha_inicio,
    fechaFin: body.fecha_fin,
    origen: "admin",
  };
}
