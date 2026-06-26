// Meses (1-12) del año dado que tienen al menos un recibo enviado — para
// marcar el desplegable de mes con un indicador visual en el frontend.
export async function fetchMesesEnviados(admin, tenantId, anio) {
  const { data, error } = await admin
    .from("academia_recibos")
    .select("mes")
    .eq("tenant_id", tenantId)
    .eq("anio", anio)
    .eq("estado", "enviado");
  if (error) return { error };
  const meses = [...new Set((data || []).map((r) => r.mes))].sort((a, b) => a - b);
  return { meses };
}
