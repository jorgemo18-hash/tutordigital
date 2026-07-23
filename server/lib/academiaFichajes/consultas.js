// Consultas de solo lectura del control horario. `admin` es siempre el
// cliente Supabase con service_role (ver createSupabaseAdmin) — el
// control de acceso real (quién puede ver qué) lo deciden las rutas
// llamando a estas funciones solo tras pasar requireRole, no las políticas
// RLS de la tabla (que son la red de seguridad para un futuro acceso
// directo del frontend, ver la migración 093).

function rangoDelMes({ mes, anio }) {
  const desde = new Date(Date.UTC(anio, mes - 1, 1)).toISOString();
  const hasta = new Date(Date.UTC(anio, mes, 1)).toISOString();
  return { desde, hasta };
}

// Personal que puede fichar en este tenant: admin y teacher (no hay rol
// "recepción" aparte — el personal de recepción usa 'admin', ver
// migración 093). `nombre` cae a "Sin nombre" solo si el perfil nunca
// rellenó display_name — no debería pasar en la práctica.
export async function fetchTrabajadoresDelTenant(admin, tenantId) {
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("user_id, role, profiles(id, display_name)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("role", ["admin", "teacher"]);
  if (error) return { error };
  const trabajadores = (data || []).map((m) => ({
    profileId: m.user_id,
    role: m.role,
    nombre: m.profiles?.display_name || "Sin nombre",
  }));
  return { trabajadores };
}

// Todos los fichajes (propios + correcciones) de un trabajador en un mes,
// en orden cronológico — la vista admin y la exportación pintan original
// y corrección como filas separadas, nunca fusionadas (ver
// fichajesSection.js/exportPdf.js/exportExcel.js).
export async function fetchFichajesDeTrabajador(admin, tenantId, workerProfileId, { mes, anio }) {
  const { desde, hasta } = rangoDelMes({ mes, anio });
  const { data, error } = await admin
    .from("academia_fichajes")
    .select("id, tipo, timestamp_servidor, origen, fichaje_corregido_id, motivo, corregido_por, corrector:profiles!academia_fichajes_corregido_por_fkey(display_name)")
    .eq("tenant_id", tenantId)
    .eq("worker_profile_id", workerProfileId)
    .gte("timestamp_servidor", desde)
    .lt("timestamp_servidor", hasta)
    .order("timestamp_servidor", { ascending: true });
  if (error) return { error };
  return {
    fichajes: (data || []).map((f) => ({
      id: f.id,
      tipo: f.tipo,
      timestamp: f.timestamp_servidor,
      origen: f.origen,
      fichajeCorregidoId: f.fichaje_corregido_id,
      motivo: f.motivo,
      corregidoPorNombre: f.corrector?.display_name || null,
    })),
  };
}

// Estado ahora mismo ("dentro"/"fuera"): el último fichaje de HOY para ese
// trabajador, propio o corregido — una corrección de admin (p.ej. "se le
// olvidó fichar la entrada esta mañana") debe reflejarse en el estado
// igual que si lo hubiera fichado él mismo.
export async function fetchEstadoActual(admin, tenantId, workerProfileId) {
  const hoy = new Date();
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())).toISOString();
  const { data, error } = await admin
    .from("academia_fichajes")
    .select("tipo, timestamp_servidor")
    .eq("tenant_id", tenantId)
    .eq("worker_profile_id", workerProfileId)
    .gte("timestamp_servidor", desde)
    .order("timestamp_servidor", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error };
  const dentro = data?.tipo === "entrada";
  return { dentro, ultimoTipo: data?.tipo || null, ultimoTimestamp: data?.timestamp_servidor || null };
}

// Nombre de un trabajador concreto — usado por la exportación (PDF/Excel)
// para el encabezado del documento, sin tener que traer la lista entera
// de trabajadores del tenant para uno solo.
export async function fetchNombreTrabajador(admin, tenantId, workerProfileId) {
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("profiles(display_name)")
    .eq("tenant_id", tenantId)
    .eq("user_id", workerProfileId)
    .maybeSingle();
  if (error) return { error };
  return { nombre: data?.profiles?.display_name || "Sin nombre" };
}

export async function fetchFichajePorId(admin, tenantId, fichajeId) {
  const { data, error } = await admin
    .from("academia_fichajes")
    .select("id, worker_profile_id, tipo, timestamp_servidor, origen")
    .eq("id", fichajeId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { error };
  return { fichaje: data || null };
}
