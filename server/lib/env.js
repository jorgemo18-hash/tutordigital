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
  // AVISO, NO `requireEnv`, y es una decisión deliberada: si esto tumbara el
  // arranque, el backend quedaría caído desde el despliegue hasta que
  // alguien pusiera la variable en Render. Sin el secreto no se pierde
  // ningún email — solo los avisos de rebote, que es lo que este aviso
  // sirve para que nadie descubra tres meses después.
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    console.warn(
      "[env] RESEND_WEBHOOK_SECRET no configurado — los webhooks de Resend se rechazarán " +
      "y NO se sabrá qué emails a familias rebotan (ver migración 122)."
    );
  }
  // LOS PEPPERS: AVISO, NO `requireEnv`. Sin ninguno de los dos los códigos
  // se siguen creando y validando (con el mismo pepper vacío en los dos
  // lados), así que hoy funcionaría. El peligro es el CAMBIO: si faltan y un
  // día se ponen —o están y un día se pierden al recrear el servicio—, todos
  // los códigos ya emitidos dejan de validar con un simple "código no
  // válido". Tumbar el arranque por esto dejaría el backend caído; lo que
  // hace falta es que se vea en el log de cada arranque.
  for (const aviso of avisosDePeppers(process.env)) console.warn(aviso);
  if (!process.env.SENTRY_DSN) {
    console.warn("[env] SENTRY_DSN no configurado — Sentry no capturará errores en este proceso.");
  }
}

// Qué decir de los peppers de los códigos (ver server/lib/codigos/hashDeCodigo.js).
export function avisosDePeppers(env) {
  const invite = Boolean(env.INVITE_CODE_PEPPER);
  const join = Boolean(env.JOIN_CODE_PEPPER);
  if (!invite && !join) {
    return ["[env] Ni INVITE_CODE_PEPPER ni JOIN_CODE_PEPPER están configurados — los códigos de " +
      "invitación y de grupo se guardan sin pepper. Si se añaden ahora, los códigos ya emitidos dejarán de validar."];
  }
  if (!invite || !join) {
    const falta = invite ? "JOIN_CODE_PEPPER" : "INVITE_CODE_PEPPER";
    return [`[env] ${falta} no configurado — se usa el otro pepper para los dos tipos de código.`];
  }
  return [];
}
