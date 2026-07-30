// Alta y baja de entradas de la lista de espera — sin las comprobaciones
// de invariantes que tiene gestion.js de academiaSustituciones (no hay
// solape ni estado que proteger aquí, es una lista simple de contactos).
export async function crearEntradaListaEspera(admin, { tenantId, nombre, curso, telefono, notas }) {
  const { data, error } = await admin
    .from("academia_lista_espera")
    .insert({
      tenant_id: tenantId,
      nombre,
      curso: curso || null,
      telefono: telefono || null,
      notas: notas || null,
    })
    .select("id, nombre, curso, telefono, notas, created_at")
    .single();
  if (error) return { ok: false, code: "crear_failed", error };
  return { ok: true, entrada: data };
}

// DELETE real (no hay histórico/auditoría que preservar aquí, a
// diferencia de revocarSustitucion) — .select().maybeSingle() tras el
// delete para distinguir "no existía en este tenant" de un error real.
export async function eliminarEntradaListaEspera(admin, { tenantId, id }) {
  const { data, error } = await admin
    .from("academia_lista_espera")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, code: "eliminar_failed", error };
  if (!data) return { ok: false, code: "not_found" };
  return { ok: true };
}
