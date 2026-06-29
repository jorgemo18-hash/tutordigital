// Régimen fiscal del tenant (tenants.regimen_fiscal: 'autonomo'|'sociedad'|
// null) — determina qué pestañas de modelo muestra el frontend (130 si es
// autónomo, 202 si es sociedad; 115/111 en ambos casos). Si es null, el
// centro no tiene el régimen configurado y la pestaña Fiscal no muestra
// ningún modelo, solo un aviso.
export async function fetchRegimenFiscal(admin, tenantId) {
  const { data, error } = await admin.from("tenants").select("regimen_fiscal").eq("id", tenantId).maybeSingle();
  if (error) return { error };
  return { regimen_fiscal: data?.regimen_fiscal || null };
}
