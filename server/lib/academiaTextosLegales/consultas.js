// Textos legales (LOPD, exención de IVA, avisos...) configurables por
// tenant — usados tanto por el CRUD de Ajustes (todos, activos e
// inactivos) como por los generadores de email/recibo (solo los activos
// de un tipo concreto, ver fetchTextosLegalesActivosPorTipo).

export async function fetchTextosLegalesPorTenant(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_textos_legales")
    .select("id, etiqueta, tipo, contenido, activo")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) return { error };
  return { textos: data || [] };
}

// `tipo`: "email" o "recibos" — devuelve también los marcados "ambos".
// Usada por plantillaEmail.js (LOPD del footer, exención de IVA del
// cuerpo) y por la preview del recibo en el panel admin. Devuelve solo el
// contenido (lo único que necesitan esos consumidores), no la fila entera.
export async function fetchTextosLegalesActivosPorTipo(admin, tenantId, tipo) {
  const { data, error } = await admin
    .from("academia_textos_legales")
    .select("contenido")
    .eq("tenant_id", tenantId)
    .eq("activo", true)
    .in("tipo", [tipo, "ambos"])
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data || []).map((t) => t.contenido).filter(Boolean);
}
