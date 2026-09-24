// EL LÍMITE DIARIO DE MENSAJES DEL ALUMNO AL TUTOR.
//
// Estaba dentro de chat.routes.js con un `catch { return { ok: true } }` y
// sin mirar el `error` de ninguna consulta: si Supabase fallaba, el límite
// dejaba pasar. Es lo que impide que una tarde rara se coma el presupuesto de
// la API, y un error de base de datos nunca es un sí (el mismo fallo que ya
// costó el aislamiento de GET /api/v1/tasks).
//
// Devuelve:
//   { ok: true }                    puede escribir
//   { ok: false, motivo: "limite" } ha llegado al límite de hoy → 429
//   { ok: false, motivo: "error" }  no se ha podido comprobar     → 503
//
// Sí deja pasar, a propósito, a quien no es alumno de ese centro (un
// profesor o un admin probando el chat): el límite es por alumno.
export const LIMITE_POR_DEFECTO = 100;

const fallo = (error) => ({ ok: false, motivo: "error", error });

export async function comprobarLimiteDiario(admin, { userId, tenantSlug, ahora = new Date() }) {
  if (!userId || !tenantSlug) return { ok: true };
  try {
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants").select("id, daily_message_limit").eq("slug", tenantSlug).maybeSingle();
    if (tenantErr) return fallo(tenantErr);
    if (!tenant) return { ok: true };

    const { data: alumno, error: alumnoErr } = await admin
      .from("students").select("id").eq("user_id", userId).eq("tenant_id", tenant.id).maybeSingle();
    if (alumnoErr) return fallo(alumnoErr);
    if (!alumno) return { ok: true };

    const { data: sesiones, error: sesErr } = await admin
      .from("tutor_sessions").select("id").eq("student_id", alumno.id).eq("tenant_id", tenant.id);
    if (sesErr) return fallo(sesErr);
    const ids = (sesiones || []).map((s) => s.id);
    if (!ids.length) return { ok: true };

    const inicioDelDia = new Date(ahora);
    inicioDelDia.setUTCHours(0, 0, 0, 0);
    const { count, error: countErr } = await admin
      .from("session_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .in("session_id", ids)
      .gte("created_at", inicioDelDia.toISOString());
    if (countErr) return fallo(countErr);

    const limite = tenant.daily_message_limit ?? LIMITE_POR_DEFECTO;
    return (count || 0) >= limite ? { ok: false, motivo: "limite" } : { ok: true };
  } catch (err) {
    return fallo(err);
  }
}
