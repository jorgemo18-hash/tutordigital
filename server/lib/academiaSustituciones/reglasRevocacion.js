// Quién puede revocar una sustitución concreta — separado de la ruta y
// de gestion.js (sin Fastify/DB) para poder testear la regla sin auth
// real. El admin puede revocar cualquiera, como hasta ahora. Un profesor
// solo puede deshacer una sustitución suya, autodeclarada por él mismo:
// nunca una creada por el admin (aunque él sea el sustituto), y nunca la
// de otro profesor — evita que "deshacer lo mío" se convierta en una
// puerta trasera para tocar sustituciones ajenas.
export function puedeRevocar({ role, profesorId, sustitucion }) {
  if (role === "admin") return { ok: true };

  if (sustitucion.profesor_sustituto_id !== profesorId) {
    return { ok: false, code: "no_es_tu_sustitucion" };
  }
  if (sustitucion.origen !== "autodeclarada") {
    return { ok: false, code: "solo_autodeclaradas" };
  }
  return { ok: true };
}
