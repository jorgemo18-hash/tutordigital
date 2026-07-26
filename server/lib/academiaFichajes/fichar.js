import { ensureProfileExists } from "../profileProvisioning.js";

// Fichaje del propio trabajador (entrada/salida) — `workerProfileId` debe
// venir SIEMPRE de req.userId (el token de sesión), nunca del body: quien
// llama a esta función ficha por sí mismo, no puede fichar por otro. El
// timestamp lo pone Postgres (default now() en la columna) — esta función
// nunca lo pasa en el INSERT, para que sea imposible aceptar por error un
// timestamp que mande el cliente.
export async function registrarFichaje(admin, { tenantId, tenantSlug, workerProfileId, tipo }) {
  if (tipo !== "entrada" && tipo !== "salida") {
    return { ok: false, code: "tipo_invalido", motivo: "El tipo de fichaje debe ser 'entrada' o 'salida'." };
  }

  // Red de seguridad: academia_fichajes.worker_profile_id exige una fila
  // en profiles (ver migración 093) que el flujo de invitación de
  // profesor no siempre crea (ver profileProvisioning.js) — sin esto, el
  // INSERT de abajo revienta con una violación de FK para cualquier
  // profesor invitado antes de este fix. `tenantSlug` se pasa para que,
  // si hay que crear la fila aquí, ensureProfileExists pueda resolver el
  // nombre real desde teacher_profiles en vez de dejarlo en NULL.
  await ensureProfileExists(admin, workerProfileId, { tenantSlug });

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

  // `error` real (código/mensaje/hint de Postgres-PostgREST) se conserva
  // en el resultado — el motivo genérico de abajo es solo el texto de
  // cara al usuario; el handler de la ruta loguea `error` tal cual, no
  // este texto (mismo bug que tenía findProfesorId: sin esto, un 500 no
  // deja ningún rastro real en los logs).
  if (error) return { ok: false, code: "fichaje_failed", motivo: "No se pudo registrar el fichaje.", error };
  return { ok: true, fichaje: { id: data.id, tipo: data.tipo, timestamp: data.timestamp_servidor } };
}
