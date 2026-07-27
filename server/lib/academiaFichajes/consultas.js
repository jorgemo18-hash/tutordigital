import { fetchNombresDePerfilesConFallback } from "../profileDisplayName.js";

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
// migración 093).
//
// Dos consultas separadas a propósito, NUNCA un embed
// `profiles(...)` sobre tenant_memberships: tenant_memberships.user_id
// referencia auth.users(id), no profiles(id) (ver 001_init.sql) — no hay
// ninguna FK entre tenant_memberships y profiles que PostgREST pueda
// resolver, así que ese embed no es "a veces falla si falta la fila", es
// "siempre falla, para cualquier trabajador" (error de relación en el
// esquema, no de datos). Bug real de producción: causaba un 500 en
// GET /academia/fichajes/trabajadores para TODOS los tenants, no solo
// cuando un admin/recepción no tenía fila en profiles. `nombre` cae a
// teacher_profiles del tenant (mismo fallback que academiaSustituciones/
// consultas.js — ver profileDisplayName.js) si profiles.display_name es
// NULL, y a "Sin nombre" solo si tampoco hay nada ahí.
export async function fetchTrabajadoresDelTenant(admin, tenantId, tenantSlug) {
  const { data: memberships, error } = await admin
    .from("tenant_memberships")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("role", ["admin", "teacher"]);
  if (error) return { error };

  const userIds = (memberships || []).map((m) => m.user_id);
  const nombrePorId = await fetchNombresDePerfilesConFallback(admin, tenantSlug, userIds);

  const trabajadores = (memberships || []).map((m) => ({
    profileId: m.user_id,
    role: m.role,
    nombre: nombrePorId.get(m.user_id) || "Sin nombre",
  }));
  return { trabajadores };
}

// Todos los fichajes (propios + correcciones) de un trabajador en un mes,
// en orden cronológico — la vista admin y la exportación pintan original
// y corrección como filas separadas, nunca fusionadas (ver
// fichajesSection.js/exportPdf.js/exportExcel.js).
//
// `corregido_por` se resuelve aparte con fetchNombresDePerfilesConFallback
// (mismo fallback a teacher_profiles que fetchTrabajadoresDelTenant/
// fetchNombreTrabajador) en vez de embeber `profiles!...fkey(display_name)`
// en la query: ese embed nunca cae a teacher_profiles cuando
// profiles.display_name es NULL, así que un admin/recepción sin nombre en
// profiles aparecía como "corregido por: null" pese a tener nombre real en
// teacher_profiles.
export async function fetchFichajesDeTrabajador(admin, tenantId, tenantSlug, workerProfileId, { mes, anio }) {
  const { desde, hasta } = rangoDelMes({ mes, anio });
  const { data, error } = await admin
    .from("academia_fichajes")
    .select("id, tipo, timestamp_servidor, origen, fichaje_corregido_id, motivo, notas, corregido_por")
    .eq("tenant_id", tenantId)
    .eq("worker_profile_id", workerProfileId)
    .gte("timestamp_servidor", desde)
    .lt("timestamp_servidor", hasta)
    .order("timestamp_servidor", { ascending: true });
  if (error) return { error };

  const correctorIds = [...new Set((data || []).map((f) => f.corregido_por).filter(Boolean))];
  const nombrePorId = await fetchNombresDePerfilesConFallback(admin, tenantSlug, correctorIds);

  return {
    fichajes: (data || []).map((f) => ({
      id: f.id,
      tipo: f.tipo,
      timestamp: f.timestamp_servidor,
      origen: f.origen,
      fichajeCorregidoId: f.fichaje_corregido_id,
      motivo: f.motivo,
      notas: f.notas || null,
      corregidoPorNombre: f.corregido_por ? (nombrePorId.get(f.corregido_por) || "Sin nombre") : null,
    })),
  };
}

// Estado ahora mismo ("dentro"/"fuera") + si ya fichó ENTRADA hoy (usado
// por el FAB de fichaje — ver assets/shared/js/fichaje/ficharFabEstado.js
// — para decidir si aparece en modo "pendiente"). Trae TODOS los
// fichajes de hoy (normalmente 0-4 filas), no solo el último: "dentro"
// depende únicamente del ÚLTIMO, pero "haFichadoEntradaHoy" tiene que
// mirar toda la lista — alguien que ya fichó entrada+salida hoy está
// "fuera" (dentro:false) pero SÍ fichó entrada, así que el FAB no debe
// volver a modo "pendiente" solo por eso. Una corrección de admin (p.ej.
// "se le olvidó fichar la entrada esta mañana") cuenta igual que si lo
// hubiera fichado él mismo.
// `hoy` como parámetro explícito (no `new Date()` cerrado dentro) para poder
// fijarlo en tests — mismo patrón que resolverAlumnoIdsVisibles/revocarSustitucion.
export async function fetchEstadoActual(admin, tenantId, workerProfileId, hoy = new Date()) {
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())).toISOString();
  const { data, error } = await admin
    .from("academia_fichajes")
    .select("tipo, timestamp_servidor")
    .eq("tenant_id", tenantId)
    .eq("worker_profile_id", workerProfileId)
    .gte("timestamp_servidor", desde)
    .order("timestamp_servidor", { ascending: true });
  if (error) return { error };
  const fichajesHoy = data || [];
  const ultimo = fichajesHoy[fichajesHoy.length - 1] || null;
  const dentro = ultimo?.tipo === "entrada";
  const haFichadoEntradaHoy = fichajesHoy.some((f) => f.tipo === "entrada");
  return {
    dentro,
    ultimoTipo: ultimo?.tipo || null,
    ultimoTimestamp: ultimo?.timestamp_servidor || null,
    haFichadoEntradaHoy,
  };
}

// Nombre de un trabajador concreto — usado por la exportación (PDF/Excel)
// para el encabezado del documento, sin tener que traer la lista entera
// de trabajadores del tenant para uno solo. Mismo motivo que
// fetchTrabajadoresDelTenant para no embeber profiles(...) sobre
// tenant_memberships: esa relación no existe para PostgREST.
export async function fetchNombreTrabajador(admin, tenantId, tenantSlug, workerProfileId) {
  const { data: membership, error } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", workerProfileId)
    .maybeSingle();
  if (error) return { error };
  if (!membership) return { nombre: "Sin nombre" };

  const nombrePorId = await fetchNombresDePerfilesConFallback(admin, tenantSlug, [workerProfileId]);
  return { nombre: nombrePorId.get(workerProfileId) || "Sin nombre" };
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
