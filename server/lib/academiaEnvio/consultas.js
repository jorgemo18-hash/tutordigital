// Consultas propias del envío combinado (familia + informes) — no
// encajan en academiaRecibos ni academiaInformes en solitario porque
// cruzan ambos dominios.

// Los email_texto_* son los únicos campos que ni fetchConfig
// (academiaRecibos) ni fetchConfigInforme (academiaInformes) seleccionan
// hoy — de ahí este tercer fetch narrow, mismo patrón que los otros dos.
export async function fetchConfigEnvio(admin, tenantId) {
  const { data } = await admin
    .from("academia_config")
    .select(
      "nombre_emisor, dni_emisor, direccion_emisor, ciudad_emisor, cp_emisor, telefono_emisor, " +
        "email_emisor, logo_url, email_texto_completo, email_texto_solo_recibo, email_texto_solo_informe"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data || {};
}

export async function fetchFamiliaConAlumnosActivos(admin, tenantId, familiaId) {
  const [{ data: familia, error: familiaErr }, { data: alumnos, error: alumnosErr }] = await Promise.all([
    admin
      .from("academia_familias")
      .select("id, nombre, email, dni, direccion, codigo_postal, ciudad, metodo_pago")
      .eq("id", familiaId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("academia_alumnos")
      .select("id, nombre, curso")
      .eq("familia_id", familiaId)
      .eq("tenant_id", tenantId)
      .eq("activo", true),
  ]);
  if (familiaErr || alumnosErr) return { error: familiaErr || alumnosErr };
  return { familia, alumnosActivos: alumnos || [] };
}

// El id del recibo de una familia concreta ese mes (si existe) — a partir
// de ahí se reutiliza fetchReciboCompleto (ya trae lineas/descuentos).
export async function fetchReciboIdDeFamiliaDelMes(admin, tenantId, familiaId, { mes, anio }) {
  const { data, error } = await admin
    .from("academia_recibos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("familia_id", familiaId)
    .eq("mes", mes)
    .eq("anio", anio)
    .maybeSingle();
  if (error) return { error };
  return { reciboId: data?.id || null };
}
