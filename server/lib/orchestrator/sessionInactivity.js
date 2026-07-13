// sessionInactivity.js — cierre por inactividad vía evaluación perezosa
// (lazy): no hay infraestructura de cron en el proyecto (Render en plan
// gratuito, sin render.yaml), así que en vez de un job programado, esta
// función se llama en los puntos donde el backend ya lista o carga sesiones
// (ver server/routes/v1/tutor-sessions.routes.js y
// server/lib/orchestrator/sessionMap.js) — cualquier lectura de una sesión
// potencialmente abandonada la cierra de paso, sin esperar a un barrido.
//
// tutor_sessions no tiene columna de "última actividad" (solo created_at) —
// la señal real es el último mensaje de session_messages. Si la sesión
// nunca llegó a tener mensajes (se creó pero el alumno no llegó a escribir),
// se usa tutor_sessions.created_at en su lugar.
const INACTIVITY_LIMIT_MS = 45 * 60 * 1000;
const OPEN_OUTCOMES = new Set([null, "in_progress"]);

export async function closeSessionIfInactive(admin, sessionId) {
  const { data: session } = await admin
    .from("tutor_sessions")
    .select("outcome, created_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || !OPEN_OUTCOMES.has(session.outcome)) {
    return { closed: false, outcome: session?.outcome ?? null };
  }

  const { data: lastMessage } = await admin
    .from("session_messages")
    .select("created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const referenceIso = lastMessage?.created_at || session.created_at;
  if (!referenceIso) return { closed: false, outcome: session.outcome };

  const inactiveMs = Date.now() - new Date(referenceIso).getTime();
  if (inactiveMs <= INACTIVITY_LIMIT_MS) return { closed: false, outcome: session.outcome };

  // Solo outcome — needs_help/escalation_reason son independientes del
  // cierre por inactividad y no se tocan aquí.
  const { error } = await admin
    .from("tutor_sessions")
    .update({ outcome: "abandoned" })
    .eq("id", sessionId);
  if (error) return { closed: false, outcome: session.outcome };

  return { closed: true, outcome: "abandoned" };
}
