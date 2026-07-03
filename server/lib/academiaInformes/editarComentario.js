// Sobrescribe el comentario del informe con el texto editado a mano por el
// admin — sin llamar a Claude. Solo tiene sentido si el informe ya existe
// (se generó al menos una vez); no crea la fila.
export async function editarComentarioInforme(admin, { tenantId, alumnoId, mes, anio, comentario }) {
  const { data, error } = await admin
    .from("academia_informes")
    .update({ comentario })
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .eq("mes", mes)
    .eq("anio", anio)
    .select("id, comentario")
    .maybeSingle();
  if (error) return { ok: false, motivo: "No se pudo guardar el comentario." };
  if (!data) return { ok: false, motivo: "No hay informe generado para editar todavía." };
  return { ok: true, comentario: data.comentario };
}
