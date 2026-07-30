// Consultas de academia_lista_espera (tabla ya existente en producción,
// RLS con política academia_lista_espera_admin_teacher_all — el backend
// usa service_role, esa política es red de seguridad, no la fuente de
// autorización real; eso lo decide requireRole en la ruta).
export async function fetchListaEsperaDelTenant(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_lista_espera")
    .select("id, nombre, curso, telefono, notas, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) return { error };
  return { entradas: data || [] };
}
