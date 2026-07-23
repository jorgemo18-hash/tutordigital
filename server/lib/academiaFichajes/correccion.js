import { fetchFichajePorId } from "./consultas.js";

// Corrección de admin sobre un fichaje — nunca UPDATE/DELETE (la tabla lo
// impide incluso a nivel de trigger, ver migración 093): esto siempre
// inserta una fila NUEVA con origen='admin_correccion', enlazada al
// fichaje que corrige (o suelta, si el trabajador directamente no fichó
// ese día). `corregidoPor` debe venir de req.userId (quién ejecuta la
// corrección), nunca del body. El motivo es obligatorio a nivel de
// aplicación — el backend rechaza la inserción si falta, tal como pide el
// modelo (la tabla también lo exige con un check constraint, esto es la
// primera línea de defensa con un mensaje claro).
export async function registrarCorreccion(admin, {
  tenantId, workerProfileId, tipo, fichajeCorregidoId = null, motivo, corregidoPor,
}) {
  if (tipo !== "entrada" && tipo !== "salida") {
    return { ok: false, code: "tipo_invalido", motivo: "El tipo de fichaje debe ser 'entrada' o 'salida'." };
  }
  if (!motivo || !motivo.trim()) {
    return { ok: false, code: "motivo_requerido", motivo: "Toda corrección necesita un motivo." };
  }

  if (fichajeCorregidoId) {
    const { fichaje, error } = await fetchFichajePorId(admin, tenantId, fichajeCorregidoId);
    if (error) return { ok: false, code: "fetch_failed", motivo: "No se pudo comprobar el fichaje a corregir." };
    if (!fichaje) return { ok: false, code: "not_found", motivo: "El fichaje que se quiere corregir no existe en este centro." };
    if (fichaje.worker_profile_id !== workerProfileId) {
      return { ok: false, code: "fichaje_de_otro_trabajador", motivo: "Ese fichaje pertenece a otro trabajador." };
    }
  }

  const { data, error } = await admin
    .from("academia_fichajes")
    .insert({
      tenant_id: tenantId,
      worker_profile_id: workerProfileId,
      tipo,
      origen: "admin_correccion",
      fichaje_corregido_id: fichajeCorregidoId,
      motivo: motivo.trim(),
      corregido_por: corregidoPor,
    })
    .select("id, tipo, timestamp_servidor")
    .single();

  if (error) return { ok: false, code: "correccion_failed", motivo: "No se pudo registrar la corrección." };
  return { ok: true, fichaje: { id: data.id, tipo: data.tipo, timestamp: data.timestamp_servidor } };
}
