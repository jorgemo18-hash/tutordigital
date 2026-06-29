// Persistencia genérica de la pestaña Fiscal — una fila por
// tenant+año+trimestre+modelo, con un jsonb `datos` cuya forma decide el
// frontend: { editable: {...}, overrides: {...}, calculado: {...} } (este
// último solo lo usa Modelo 130, que es el único con casillas derivadas de
// Ingresos/Gastos en vez de puramente editables/calculadas en cliente).
// Una vez guardado un período, se carga tal cual en las próximas visitas
// (no se vuelve a recalcular desde Ingresos/Gastos) — guardar es la forma
// de "cerrar" ese trimestre con los números que tenía en ese momento.
export async function fetchTrimestreGuardado(admin, tenantId, { anio, trimestre, modelo }) {
  const { data, error } = await admin
    .from("academia_fiscal_trimestres")
    .select("datos")
    .eq("tenant_id", tenantId)
    .eq("anio", anio)
    .eq("trimestre", trimestre)
    .eq("modelo", modelo)
    .maybeSingle();
  if (error) return { error };
  return { datos: data?.datos || null };
}

export async function guardarTrimestre(admin, tenantId, { anio, trimestre, modelo, datos }) {
  const { error } = await admin.from("academia_fiscal_trimestres").upsert(
    { tenant_id: tenantId, anio, trimestre, modelo, datos, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,anio,trimestre,modelo" }
  );
  if (error) return { error };
  return { ok: true };
}
