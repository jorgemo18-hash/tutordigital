export const CURSOS = [
  "1º PRIM", "2º PRIM", "3º PRIM", "4º PRIM", "5º PRIM", "6º PRIM",
  "1º ESO", "2º ESO", "3º ESO", "4º ESO",
  "1º BACH", "2º BACH",
];

export function nivelDeCurso(curso) {
  const c = String(curso || "");
  if (c.includes("PRIM")) return "primaria";
  if (c.includes("ESO")) return "eso";
  if (c.includes("BACH")) return "bachillerato";
  return null;
}

export function calcPrecioNeto(precioBruto, descuentoPct) {
  const bruto = Number(precioBruto) || 0;
  const descuento = Number(descuentoPct) || 0;
  return Math.round(bruto * (1 - descuento / 100) * 100) / 100;
}

// Aplana familia_id/familia_nombre/familia_email — columnas planas que
// devuelven las RPC que leen auth.users (academia_alumnos_list_activos y
// academia_alumnos_pendientes_confirmacion, migración 076, PostgREST no
// puede anidar un embed ahí) — al mismo { familia: {id,nombre,email} } que
// ya devuelve el embed de PostgREST en el resto de queries de alumnos.
export function mapAlumnoFamiliaPlana({ familia_id, familia_nombre, familia_email, ...resto }) {
  return { ...resto, familia: familia_id ? { id: familia_id, nombre: familia_nombre, email: familia_email } : null };
}

// Resuelve el familia_id a usar: crea la familia si viene `familiaNueva`,
// reutiliza `familiaId` si viene, o null si el alumno no tiene familia.
export async function resolverFamiliaId(admin, tenantId, { familiaId, familiaNueva }) {
  if (familiaNueva) {
    const { data, error } = await admin
      .from("academia_familias")
      .insert({ tenant_id: tenantId, activa: true, ...familiaNueva })
      .select("id")
      .single();
    if (error) return { ok: false, error };
    return { ok: true, familiaId: data.id };
  }
  if (familiaId) {
    const { data, error } = await admin
      .from("academia_familias")
      .select("id")
      .eq("id", familiaId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) return { ok: false, error };
    if (!data) return { ok: false, notFound: true };
    return { ok: true, familiaId };
  }
  return { ok: true, familiaId: null };
}

export async function actualizarFamilia(admin, tenantId, familiaId, fields) {
  return admin.from("academia_familias").update(fields).eq("id", familiaId).eq("tenant_id", tenantId);
}

export async function cerrarHorarioVigente(admin, tenantId, alumnoId, fechaCierre) {
  return admin
    .from("academia_horario")
    .update({ fecha_fin: fechaCierre })
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .is("fecha_fin", null);
}

// Marca la baja del alumno y cierra su horario vigente en el mismo
// fecha_baja (no "hoy" recalculado aparte) — extraído de
// academia.alumnos.archivar.routes.js para poder testear la secuencia
// completa sin credenciales reales (el guard de auth de la ruta no se
// puede saltar en tests). `paso` en el resultado de error identifica cuál
// de los dos UPDATE falló, para que la ruta pueda devolver el código HTTP
// distinto que ya devolvía antes de esta extracción.
export async function marcarBajaYCerrarHorario(admin, tenantId, alumnoId, fechaBaja) {
  const { error: alumnoErr } = await admin
    .from("academia_alumnos")
    .update({ activo: false, fecha_baja: fechaBaja })
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId);
  if (alumnoErr) return { error: alumnoErr, paso: "alumno" };

  const { error: horarioErr } = await cerrarHorarioVigente(admin, tenantId, alumnoId, fechaBaja);
  if (horarioErr) return { error: horarioErr, paso: "horario" };

  // Y la TARIFA (auditoría del 08/09/2026). Se cerraba el horario y no la
  // tarifa, así que un alumno de baja seguía con precio vigente: en
  // producción había 13 así, sumando 1.065 €/mes de tarifas abiertas de
  // gente que ya no viene.
  //
  // Hoy no se les cobra —los recibos filtran por alumno activo (ver
  // academiaRecibos/consultas.js)— pero la tabla miente, y el día que
  // alguien escriba un informe de ingresos previstos leyendo "tarifas
  // vigentes" sin unirlo con `activo`, el número saldrá inflado sin que
  // nada falle. Un dato que miente en silencio es peor que un error.
  const { error: tarifaErr } = await cerrarTarifaVigente(admin, tenantId, alumnoId, fechaBaja);
  if (tarifaErr) return { error: tarifaErr, paso: "tarifa" };

  return { error: null, paso: null };
}

// Restaurar NO reactiva el horario anterior — decisión de producto
// (2026-08-01, ver comentario completo en el PUT /:id/restaurar): la
// plaza en una franja es finita y puede haberse dado a otro alumno
// mientras este estaba de baja, así que el admin reasigna a mano.
export async function restaurarAlumno(admin, tenantId, alumnoId) {
  return admin
    .from("academia_alumnos")
    .update({ activo: true, fecha_baja: null })
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId);
}

export async function insertarHorario(admin, tenantId, alumnoId, horario, fechaInicio) {
  if (!horario?.length) return { error: null };
  const rows = horario.map((h) => ({
    tenant_id: tenantId,
    alumno_id: alumnoId,
    dia_semana: h.dia_semana,
    hora_inicio: h.hora_inicio,
    hora_fin: h.hora_fin,
    // null = franja sin profesor asignado, estado legítimo (migración 109).
    // `?? null` y no `|| null` para no convertir nada por accidente: el id
    // es un uuid, pero la intención es "solo undefined cuenta como ausente".
    profesor_id: h.profesor_id ?? null,
    fecha_inicio: fechaInicio,
  }));
  const { error } = await admin.from("academia_horario").insert(rows);
  return { error };
}

// .slice(0,5) normaliza "15:30:00" (como vuelve `time` de Postgres) contra
// "15:30" (como llega del cuerpo de la petición, ver HorarioEntrySchema) —
// sin esto, un horario idéntico se detectaría siempre como "cambiado".
// profesor_id entra en la clave: si no, cambiar SOLO el profesor de una
// franja (misma hora, mismo día) se leería como "el horario no ha
// cambiado" y el guardado se descartaría en silencio.
function horarioKey(h) {
  return `${h.dia_semana}|${String(h.hora_inicio).slice(0, 5)}|${String(h.hora_fin).slice(0, 5)}|${h.profesor_id ?? ""}`;
}

// Comparación por conjunto, no por orden de llegada — el admin no controla
// en qué orden salen los checkboxes marcados de horarioSection.js.
//
// `fechaInicio` (11/09/2026): la fecha desde la que cuenta el horario es
// PARTE del horario, y no estaba en la comparación. Consecuencia real: al
// cambiar solo la fecha —sin tocar ninguna casilla— esto decía "sin
// cambios", el guardado se daba la vuelta y la fecha no se guardaba. El
// alumno seguía saliendo en el diario y no había ningún error que lo
// explicara.
//
// Solo se compara si el llamador la manda. Un llamador que no la pase
// (cualquier caller viejo) sigue comparando únicamente las franjas, que es
// lo que hacía siempre: si se comparara contra "hoy" por defecto, CADA
// guardado de la ficha vería un cambio y volvería el churn de filas que
// esta función existe para evitar.
export function horarioSinCambios(vigente, nuevo, fechaInicio = null) {
  const a = (vigente || []).map(horarioKey).sort();
  const b = (nuevo || []).map(horarioKey).sort();
  const franjasIguales = a.length === b.length && a.every((k, i) => k === b[i]);
  if (!franjasIguales || !fechaInicio) return franjasIguales;

  // Todas las franjas vigentes comparten fecha (se insertan juntas), así
  // que basta la primera. Sin franjas vigentes no hay fecha que comparar y
  // manda el resultado de las franjas.
  const fechaVigente = String((vigente || [])[0]?.fecha_inicio || "").slice(0, 10);
  if (!fechaVigente) return true;
  return fechaVigente === String(fechaInicio).slice(0, 10);
}

export async function fetchHorarioVigente(admin, tenantId, alumnoId) {
  const { data, error } = await admin
    .from("academia_horario")
    // fecha_inicio entra el 11/09/2026: sin ella no hay con qué comparar
    // cuando lo ÚNICO que cambia es la fecha de inicio, y el guardado se
    // daba la vuelta sin escribir nada (ver actualizarHorarioSiCambia).
    .select("dia_semana, hora_inicio, hora_fin, profesor_id, fecha_inicio")
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .is("fecha_fin", null);
  if (error) return { error };
  return { horario: data || [] };
}

// Único punto de entrada para guardar el horario de un alumno — antes
// PUT /:id/horario cerraba y recreaba SIEMPRE, y guardarCambios() en el
// drawer llama a este endpoint en cada guardado del alumno aunque no se
// toque el horario (ver alumnoDrawerActions.js). Resultado real en
// producción: 32 de 47 filas de Lyceo ya cerradas, para alumnos que
// siguen activos — no cambios de horario reales, sino churn de guardados
// que no tocaban el horario. Comparar aquí, en el backend, protege a
// cualquier llamador futuro (importación, otro endpoint admin), no solo
// al que existe hoy.
// `fechaInicio` (por defecto, hoy) es el día en que EMPIEZA el horario
// nuevo, y es distinta de `hoy`, que es el día en que se cierra el viejo.
// Separarlas es lo que permite decir "este alumno vuelve el 6 de octubre":
// sus franjas nacen con fecha_inicio de octubre y el diario no las enseña
// hasta entonces (GET /academia/sesiones filtra por fecha_inicio <= fecha),
// mientras el cuadrante sí las pinta desde ya, que es para lo que se mira.
//
// El horario viejo se sigue cerrando HOY y no el día antes de la nueva
// fecha, a propósito: el caso real es un alumno que ahora no viene, así que
// el hueco entre hoy y su vuelta es correcto. Y no duplica a nadie en el
// diario del día del cambio porque mergeHorarioYSesiones deduplica por
// alumno (comprobado).
export async function actualizarHorarioSiCambia(admin, tenantId, alumnoId, horarioNuevo, hoy, fechaInicio = null) {
  const { horario: vigente, error: fetchErr } = await fetchHorarioVigente(admin, tenantId, alumnoId);
  if (fetchErr) return { error: fetchErr, cambiado: false };

  if (horarioSinCambios(vigente, horarioNuevo, fechaInicio)) {
    return { error: null, cambiado: false };
  }

  const { error: cerrarErr } = await cerrarHorarioVigente(admin, tenantId, alumnoId, hoy);
  if (cerrarErr) return { error: cerrarErr, cambiado: false };

  const { error: insertErr } = await insertarHorario(
    admin, tenantId, alumnoId, horarioNuevo, fechaInicio || hoy
  );
  if (insertErr) return { error: insertErr, cambiado: false };

  return { error: null, cambiado: true };
}

// Mismo problema que tenía el horario y misma solución: PUT /alumnos/:id
// cerraba la tarifa vigente e insertaba una nueva SIEMPRE, y el drawer manda
// la tarifa en cada guardado aunque no se haya tocado (ver
// alumnoDrawerActions.js#recogerPayloadComun). Abrir una ficha para corregir
// un teléfono y guardar dejaba una fila cerrada y otra abierta con el mismo
// precio y la misma fecha — tres guardados el mismo día, tres filas basura.
//
// Y no era solo ruido: si el cierre iba bien pero el INSERT fallaba, el
// alumno se quedaba SIN tarifa vigente, y un alumno sin tarifa entra en el
// recibo con precio 0 (ver fetchFamiliasConAlumnos).
export function tarifaSinCambios(vigente, nueva) {
  if (!vigente || !nueva) return false;
  return (
    Number(vigente.precio_bruto) === Number(nueva.precio_bruto) &&
    Number(vigente.descuento_pct || 0) === Number(nueva.descuento_pct || 0)
  );
}

export async function fetchTarifaVigente(admin, tenantId, alumnoId) {
  const { data, error } = await admin
    .from("academia_tarifas")
    .select("id, precio_bruto, descuento_pct")
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .is("fecha_fin", null)
    .maybeSingle();
  if (error) return { error };
  return { tarifa: data || null };
}

// Único punto de entrada para actualizar la tarifa de un alumno, equivalente
// a actualizarHorarioSiCambia. `paso` en el error identifica cuál de las dos
// escrituras falló, para que la ruta pueda distinguirlas en el log.
export async function actualizarTarifaSiCambia(admin, tenantId, alumnoId, tarifaNueva, hoy) {
  const { tarifa: vigente, error: fetchErr } = await fetchTarifaVigente(admin, tenantId, alumnoId);
  if (fetchErr) return { error: fetchErr, cambiado: false };

  if (tarifaSinCambios(vigente, tarifaNueva)) return { error: null, cambiado: false };

  const { error: cerrarErr } = await cerrarTarifaVigente(admin, tenantId, alumnoId, hoy);
  if (cerrarErr) return { error: cerrarErr, cambiado: false, paso: "cerrar" };

  const { error: insertErr } = await insertarTarifa(admin, tenantId, alumnoId, tarifaNueva, hoy);
  if (insertErr) return { error: insertErr, cambiado: false, paso: "insertar" };

  return { error: null, cambiado: true };
}

export async function cerrarTarifaVigente(admin, tenantId, alumnoId, fechaCierre) {
  return admin
    .from("academia_tarifas")
    .update({ fecha_fin: fechaCierre })
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .is("fecha_fin", null);
}

export async function insertarTarifa(admin, tenantId, alumnoId, { precio_bruto, descuento_pct = 0 }, fechaInicio) {
  const precio_neto = calcPrecioNeto(precio_bruto, descuento_pct);
  const { data, error } = await admin
    .from("academia_tarifas")
    .insert({
      tenant_id: tenantId,
      alumno_id: alumnoId,
      precio_bruto,
      descuento_pct,
      precio_neto,
      fecha_inicio: fechaInicio,
    })
    .select("id, precio_bruto, descuento_pct, precio_neto, fecha_inicio")
    .single();
  return { data, error };
}

// Combina alumnos con su tarifa vigente y si tienen horario asignado — usado
// por GET / (ambas ramas) para el indicador "datos incompletos" del listado
// (ver alumnosListRow.js). Recibe las filas ya obtenidas (no hace queries)
// para poder testearse sin un cliente Supabase real.
export function enriquecerConTarifaYHorario(alumnos, tarifas, horarios) {
  const tarifaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, { precio_neto: t.precio_neto }]));
  const idsConHorario = new Set((horarios || []).map((h) => h.alumno_id));
  return alumnos.map((a) => ({
    ...a,
    tarifa_vigente: tarifaPorAlumno[a.id] || null,
    tiene_horario: idsConHorario.has(a.id),
  }));
}

// Alumno + familia completa + horario vigente + tarifa vigente, para las
// respuestas de GET /:id, POST y PUT — siempre la misma forma.
export async function fetchAlumnoCompleto(admin, tenantId, alumnoId) {
  const [{ data: alumno, error: alumnoErr }, { data: horario, error: horarioErr }, { data: tarifa, error: tarifaErr }] =
    await Promise.all([
      admin
        .from("academia_alumnos")
        .select(
          "id, nombre, curso, nivel, activo, fecha_alta, fecha_baja, " +
          "email, telefono, direccion, ciudad, codigo_postal, ficha_url, ficha_path, " +
          "familia:academia_familias(*)"
        )
        .eq("id", alumnoId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      admin
        .from("academia_horario")
        // profesor_id NO es decorativo aquí: la rejilla del drawer se pinta
        // con este horario y, al guardar, actualizarHorarioSiCambia compara
        // lo que devuelve la rejilla contra la base de datos incluyendo el
        // profesor. Sin traerlo, cada edición de la ficha veía "sin
        // profesor" y borraba en silencio quién imparte cada franja.
        // fecha_inicio TAMPOCO es decorativa: es lo que el drawer enseña en
        // "Empieza el" (ver fechaInicioHorario.js). Sin traerla, ese campo
        // se rellenaría con hoy cada vez que se abre la ficha, y el primer
        // guardado adelantaría al alumno al Diario — el mismo fallo que
        // tuvo profesor_id, con la misma forma: un campo que falta en el
        // SELECT llega como undefined y undefined parece un valor legítimo.
        .select("id, dia_semana, hora_inicio, hora_fin, profesor_id, fecha_inicio")
        .eq("tenant_id", tenantId)
        .eq("alumno_id", alumnoId)
        .is("fecha_fin", null)
        .order("dia_semana", { ascending: true })
        .order("hora_inicio", { ascending: true }),
      admin
        .from("academia_tarifas")
        .select("id, precio_bruto, descuento_pct, precio_neto, fecha_inicio")
        .eq("tenant_id", tenantId)
        .eq("alumno_id", alumnoId)
        .is("fecha_fin", null)
        .maybeSingle(),
    ]);

  if (alumnoErr || horarioErr || tarifaErr) return { error: alumnoErr || horarioErr || tarifaErr };
  if (!alumno) return { data: null };

  return { data: { ...alumno, horario: horario || [], tarifa: tarifa || null } };
}
