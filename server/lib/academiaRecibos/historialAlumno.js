// Historial de recibos de un alumno: academia_recibos_lineas no tiene
// tenant_id propio, así que primero se acotan los recibos del tenant y
// luego se buscan las líneas de ese alumno entre esos ids — evita un join
// embebido filtrando por una columna de la tabla relacionada.
export async function fetchHistorialReciboAlumno(admin, tenantId, alumnoId) {
  const { data: recibosTenant, error: recibosErr } = await admin
    .from("academia_recibos")
    .select("id, mes, anio, concepto, total_neto, estado, fecha_envio")
    .eq("tenant_id", tenantId);
  if (recibosErr) return { error: recibosErr };

  const reciboPorId = Object.fromEntries((recibosTenant || []).map((r) => [r.id, r]));
  const reciboIds = Object.keys(reciboPorId);
  if (!reciboIds.length) return { historial: [] };

  const { data: lineas, error: lineasErr } = await admin
    .from("academia_recibos_lineas")
    .select("recibo_id, precio_bruto")
    .eq("alumno_id", alumnoId)
    .in("recibo_id", reciboIds);
  if (lineasErr) return { error: lineasErr };

  const historial = (lineas || [])
    .map((l) => {
      const recibo = reciboPorId[l.recibo_id];
      if (!recibo) return null;
      return {
        id: recibo.id,
        mes: recibo.mes,
        anio: recibo.anio,
        concepto: recibo.concepto,
        precio_bruto: l.precio_bruto,
        total_neto: recibo.total_neto,
        estado: recibo.estado,
        fecha_envio: recibo.fecha_envio,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  return { historial };
}
