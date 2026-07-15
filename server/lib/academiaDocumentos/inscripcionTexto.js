// Texto de protección de datos de la cara trasera de la hoja de
// inscripción — vive en academia_textos_legales con tipo 'inscripcion'
// (ver migración 087), pero a diferencia del resto de esa tabla (lista
// libre gestionada desde Ajustes › Marca y textos) se trata como un
// singleton por tenant: la pestaña Inscripción solo conoce "el" texto,
// nunca una lista, así que create-si-no-existe / update-si-existe en vez
// de exponer el CRUD genérico de textosLegalesPanel.js.
const TIPO = "inscripcion";
const ETIQUETA_DEFAULT = "Protección de datos — hoja de inscripción";

export async function fetchTextoInscripcion(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_textos_legales")
    .select("contenido")
    .eq("tenant_id", tenantId)
    .eq("tipo", TIPO)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { error };
  return { contenido: data?.contenido || "" };
}

export async function guardarTextoInscripcion(admin, tenantId, contenido) {
  const { data: existente, error: buscarErr } = await admin
    .from("academia_textos_legales")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("tipo", TIPO)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (buscarErr) return { ok: false, error: buscarErr };

  if (existente) {
    const { error } = await admin.from("academia_textos_legales").update({ contenido }).eq("id", existente.id);
    if (error) return { ok: false, error };
    return { ok: true };
  }

  const { error } = await admin
    .from("academia_textos_legales")
    .insert({ tenant_id: tenantId, etiqueta: ETIQUETA_DEFAULT, tipo: TIPO, contenido, activo: true });
  if (error) return { ok: false, error };
  return { ok: true };
}
