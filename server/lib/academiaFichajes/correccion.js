import { fetchFichajePorId } from "./consultas.js";
import { ensureProfileExists } from "../profileProvisioning.js";

// Corrección de admin sobre un fichaje — nunca UPDATE/DELETE (la tabla lo
// impide incluso a nivel de trigger, ver migración 093): esto siempre
// inserta una fila NUEVA con origen='admin_correccion', enlazada al
// fichaje que corrige (o suelta, si el trabajador directamente no fichó
// ese día). `fichajeCorregidoId` puede apuntar tanto a un fichaje
// original como a otra corrección ya existente — encadenar correcciones
// (p.ej. "me equivoqué al escribir el motivo de la corrección anterior")
// funciona igual: la solución sigue siendo una fila nueva, nunca editar
// la existente. `corregidoPor` debe venir de req.userId (quién ejecuta la
// corrección), nunca del body. El motivo es obligatorio a nivel de
// aplicación — el backend rechaza la inserción si falta, tal como pide el
// modelo (la tabla también lo exige con un check constraint, esto es la
// primera línea de defensa con un mensaje claro). `notas` es libre y
// opcional (migración 096), contexto adicional aparte del motivo corto.
export async function registrarCorreccion(admin, {
  tenantId, tenantSlug, workerProfileId, tipo, fichajeCorregidoId = null, motivo, corregidoPor, notas = null,
}) {
  if (tipo !== "entrada" && tipo !== "salida") {
    return { ok: false, code: "tipo_invalido", motivo: "El tipo de fichaje debe ser 'entrada' o 'salida'." };
  }
  if (!motivo || !motivo.trim()) {
    return { ok: false, code: "motivo_requerido", motivo: "Toda corrección necesita un motivo." };
  }

  if (fichajeCorregidoId) {
    const { fichaje, error } = await fetchFichajePorId(admin, tenantId, fichajeCorregidoId);
    if (error) return { ok: false, code: "fetch_failed", motivo: "No se pudo comprobar el fichaje a corregir.", error };
    if (!fichaje) return { ok: false, code: "not_found", motivo: "El fichaje que se quiere corregir no existe en este centro." };
    if (fichaje.worker_profile_id !== workerProfileId) {
      return { ok: false, code: "fichaje_de_otro_trabajador", motivo: "Ese fichaje pertenece a otro trabajador." };
    }
  }

  // Red de seguridad: worker_profile_id Y corregido_por exigen cada uno
  // una fila en profiles (ver migración 093) — mismo hueco del flujo de
  // invitación de profesor que registrarFichaje.js, aquí por partida
  // doble porque esta inserción toca las dos columnas. `tenantSlug` para
  // que, si hay que crear alguna de las dos, se resuelva el nombre real
  // desde teacher_profiles en vez de NULL (ver profileProvisioning.js).
  await ensureProfileExists(admin, workerProfileId, { tenantSlug });
  await ensureProfileExists(admin, corregidoPor, { tenantSlug });

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
      notas: notas?.trim() || null,
    })
    .select("id, tipo, timestamp_servidor")
    .single();

  // Igual que en fichar.js: se conserva el `error` real de
  // Postgres/PostgREST para que la ruta lo pueda loguear tal cual, no
  // solo este texto genérico de cara al usuario.
  if (error) return { ok: false, code: "correccion_failed", motivo: "No se pudo registrar la corrección.", error };
  return { ok: true, fichaje: { id: data.id, tipo: data.tipo, timestamp: data.timestamp_servidor } };
}
