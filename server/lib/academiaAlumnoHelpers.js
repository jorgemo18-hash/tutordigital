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

export async function insertarHorario(admin, tenantId, alumnoId, horario, fechaInicio) {
  if (!horario?.length) return { error: null };
  const rows = horario.map((h) => ({
    tenant_id: tenantId,
    alumno_id: alumnoId,
    dia_semana: h.dia_semana,
    hora_inicio: h.hora_inicio,
    hora_fin: h.hora_fin,
    fecha_inicio: fechaInicio,
  }));
  const { error } = await admin.from("academia_horario").insert(rows);
  return { error };
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

// Alumno + familia completa + horario vigente + tarifa vigente, para las
// respuestas de GET /:id, POST y PUT — siempre la misma forma.
export async function fetchAlumnoCompleto(admin, tenantId, alumnoId) {
  const [{ data: alumno, error: alumnoErr }, { data: horario, error: horarioErr }, { data: tarifa, error: tarifaErr }] =
    await Promise.all([
      admin
        .from("academia_alumnos")
        .select(
          "id, nombre, curso, nivel, activo, fecha_alta, fecha_baja, " +
          "email, telefono, direccion, ciudad, codigo_postal, " +
          "familia:academia_familias(*)"
        )
        .eq("id", alumnoId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      admin
        .from("academia_horario")
        .select("id, dia_semana, hora_inicio, hora_fin")
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
