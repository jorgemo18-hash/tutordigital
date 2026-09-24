// "ÚLTIMA VEZ VISTO" DEL PROFESOR: al abrir el panel (que siempre pide sus
// tareas) se apunta en teacher_profiles.last_seen_at, como mucho una vez por
// hora. No se espera: si falla, solo se deja un aviso en el log.
export function marcaLatidoDelProfesor(admin, auth, log, ahora = Date.now()) {
  const haceUnaHora = new Date(ahora - 3_600_000).toISOString();
  return admin
    .from("teacher_profiles")
    .update({ last_seen_at: new Date(ahora).toISOString() })
    .eq("user_id", auth.user.id)
    .eq("tenant_id", auth.tenant.id)
    .or(`last_seen_at.is.null,last_seen_at.lt.${haceUnaHora}`)
    .then(() => {})
    .catch((err) => log?.warn?.({ err }, "teacher heartbeat update failed"));
}
