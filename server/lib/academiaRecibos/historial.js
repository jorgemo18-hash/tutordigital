// EL HISTORIAL DE UN RECIBO Y "RECUPERAR LO QUE SE PERDIÓ AL REHACERLO".
//
// La tabla la escribe un trigger (migración 134): cada creación, pago,
// envío, cambio y borrado de un recibo, con su foto antes y después. Aquí
// se lee por familia + mes + año, que es lo que no cambia al regenerar (el
// id del recibo sí cambia).
//
// RECUPERAR: si un recibo se rehízo y el nuevo ha nacido "sin enviar"
// cuando el que se borró estaba enviado o pagado, se puede devolver su
// estado y sus fechas tal como estaban. Solo desde el historial: nunca con
// datos que mande el navegador.

const ESTADOS_QUE_SE_RECUPERAN = new Set(["enviado", "pagado"]);

export async function fetchHistorialDelPeriodo(admin, tenantId, { familiaId, mes, anio }) {
  const { data, error } = await admin
    .from("academia_recibos_historial")
    .select("id, recibo_id, accion, antes, despues, created_at")
    .eq("tenant_id", tenantId)
    .eq("familia_id", familiaId)
    .eq("mes", mes)
    .eq("anio", anio)
    .order("id", { ascending: true });
  if (error) return { error };
  return { eventos: data || [] };
}

// Qué se puede devolver al recibo actual: la foto del ÚLTIMO recibo borrado
// antes de que se creara éste, si estaba enviado o pagado y el actual sigue
// en borrador. null si no hay nada que recuperar.
export function estadoRecuperable(eventos, reciboActual) {
  if (!reciboActual || reciboActual.estado !== "borrador") return null;
  const creado = eventos.find((e) => e.accion === "creado" && e.recibo_id === reciboActual.id);
  const limite = creado ? creado.id : Infinity;
  const borrados = eventos.filter((e) => e.accion === "borrado" && e.id < limite && e.recibo_id !== reciboActual.id);
  const ultimo = borrados[borrados.length - 1];
  const antes = ultimo?.antes;
  if (!antes || !ESTADOS_QUE_SE_RECUPERAN.has(antes.estado)) return null;
  return {
    estado: antes.estado,
    fecha_pago: antes.estado === "pagado" ? (antes.fecha_pago || null) : null,
    fecha_envio: antes.fecha_envio || null,
    borrado_el: ultimo.created_at,
  };
}

export async function recuperarEstadoDelRecibo(admin, { tenantId, reciboId }) {
  const { data: recibo, error: reciboErr } = await admin
    .from("academia_recibos")
    .select("id, familia_id, mes, anio, estado")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reciboErr) return { ok: false, status: 500, motivo: "No se pudo leer el recibo." };
  if (!recibo) return { ok: false, status: 404, motivo: "Recibo no encontrado." };

  const { eventos, error } = await fetchHistorialDelPeriodo(admin, tenantId, {
    familiaId: recibo.familia_id, mes: recibo.mes, anio: recibo.anio,
  });
  if (error) return { ok: false, status: 500, motivo: "No se pudo leer el historial." };

  const recuperable = estadoRecuperable(eventos, recibo);
  if (!recuperable) return { ok: false, status: 409, motivo: "No hay nada que recuperar en este recibo." };

  const { error: updErr } = await admin
    .from("academia_recibos")
    .update({ estado: recuperable.estado, fecha_pago: recuperable.fecha_pago, fecha_envio: recuperable.fecha_envio })
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (updErr) return { ok: false, status: 500, motivo: "No se pudo recuperar el estado." };
  return { ok: true, recuperado: recuperable };
}
