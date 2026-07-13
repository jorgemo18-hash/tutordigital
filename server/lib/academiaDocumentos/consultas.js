// Solo las columnas de academia_config que necesita la hoja de inscripción
// (ver payload.js) — igual criterio que academiaInformes/consultas.js:
// seleccionar solo lo que se usa, no toda la fila.
export async function fetchConfigHojaInscripcion(admin, tenantId) {
  const { data } = await admin
    .from("academia_config")
    .select("nombre_emisor, ciudad_emisor, logo_url, iban, bizum_emisor")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data || {};
}
