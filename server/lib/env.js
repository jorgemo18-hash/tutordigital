export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function getEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null ? fallback : value;
}

// Falla al arranque (no en el primer request) si falta una clave crítica en
// producción. En dev/test no se exige — no todo el mundo tiene RESEND_API_KEY
// o ANTHROPIC_API_KEY configuradas localmente.
export function validateStartupEnv() {
  if (process.env.NODE_ENV !== "production") return;
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("SUPABASE_ANON_KEY");
  requireEnv("ANTHROPIC_API_KEY");
  requireEnv("RESEND_API_KEY");
  // Sin esto, las cinco rutas que generan PDF caían al fallback de
  // localhost y fallaban en silencio en cada envío: recibos, informes,
  // normas y hoja de inscripción quedaban rotos con un error de red
  // genérico que no señalaba a la variable mal puesta en Render.
  requireEnv("PDF_SERVICE_URL");
  if (!process.env.SENTRY_DSN) {
    console.warn("[env] SENTRY_DSN no configurado — Sentry no capturará errores en este proceso.");
  }
}
