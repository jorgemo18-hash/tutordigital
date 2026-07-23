// Fichaje del propio trabajador (entrada/salida) — `workerProfileId` debe
// venir SIEMPRE de req.userId (el token de sesión), nunca del body: quien
// llama a esta función ficha por sí mismo, no puede fichar por otro. El
// timestamp lo pone Postgres (default now() en la columna) — esta función
// nunca lo pasa en el INSERT, para que sea imposible aceptar por error un
// timestamp que mande el cliente.
export async function registrarFichaje(admin, { tenantId, workerProfileId, tipo }) {
  if (tipo !== "entrada" && tipo !== "salida") {
    return { ok: false, code: "tipo_invalido", motivo: "El tipo de fichaje debe ser 'entrada' o 'salida'." };
  }

  const { data, error } = await admin
    .from("academia_fichajes")
    .insert({
      tenant_id: tenantId,
      worker_profile_id: workerProfileId,
      tipo,
      origen: "worker",
    })
    .select("id, tipo, timestamp_servidor")
    .single();

  if (error) return { ok: false, code: "fichaje_failed", motivo: "No se pudo registrar el fichaje." };
  return { ok: true, fichaje: { id: data.id, tipo: data.tipo, timestamp: data.timestamp_servidor } };
}
