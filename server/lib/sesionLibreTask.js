// Sesión libre: sesión de tutor sin tarea asignada por un profesor (caso
// academia — el alumno sube sus propios deberes del cole). Crea o reutiliza
// una tarea de sistema (type: "sesion_libre", sin group_id, propia del
// alumno vía student_id) — esa tarea es la percha para /api/v1/attachments
// y /api/v1/session/start, que no cambian de contrato.
const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });

function titleForToday(now) {
  return `Sesión libre — ${DATE_FORMATTER.format(now)}`;
}

// Una tarea de sesión libre por alumno y día — reutilizable si el alumno
// recarga la página o vuelve más tarde el mismo día.
export async function ensureSesionLibreTask(admin, { tenantId, studentId, now = new Date() }) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

  const { data: existing } = await admin
    .from("tasks")
    .select("id, title, type, created_at")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("type", "sesion_libre")
    .gte("created_at", dayStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await admin
    .from("tasks")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      group_id: null,
      teacher_id: null,
      type: "sesion_libre",
      title: titleForToday(now),
      created_at: now.toISOString(),
    })
    .select("id, title, type, created_at")
    .single();

  if (error) throw new Error(`No se pudo crear la sesión libre: ${error.message}`);
  return created;
}
