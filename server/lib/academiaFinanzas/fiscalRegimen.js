// Régimen fiscal y metadatos de configuración fiscal del tenant —
// devueltos juntos para que el frontend pueda decidir en un solo fetch:
// qué modelos mostrar (regimen_fiscal), si la pestaña Fiscal aplica
// (tenant_type === 'academia') y si el M303 está disponible (desglose_iva).
export async function fetchRegimenFiscal(admin, tenantId) {
  const [tenantRes, configRes] = await Promise.all([
    admin.from("tenants").select("regimen_fiscal, type").eq("id", tenantId).maybeSingle(),
    admin.from("academia_config").select("desglose_iva").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (tenantRes.error) return { error: tenantRes.error };
  return {
    regimen_fiscal: tenantRes.data?.regimen_fiscal || null,
    tenant_type:    tenantRes.data?.type || null,
    desglose_iva:   Boolean(configRes.data?.desglose_iva),
  };
}
