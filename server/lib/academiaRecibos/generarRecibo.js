import { calcularDescuento, combinarPorcentajes, intervaloAplica, siguienteNumeroRecibo } from "./calculos.js";

// Crea un recibo + sus líneas para una familia concreta. No comprueba si ya
// existe uno para ese período — eso lo decide el llamador (generar.routes.js)
// antes de invocarla, tanto para la primera generación como para regenerar.
// `descuentosPorAlumno` (alumno_id -> [{porcentaje, acumulable, intervalo}])
// trae solo los descuentos recurrentes ACTIVOS de cada alumno — el filtro
// por intervalo vs su fecha_alta se hace aquí, alumno a alumno, porque cada
// uno puede tener un fecha_alta y unos descuentos distintos.
// El descuento de hermanos automático desapareció (ver docs/cambios o el
// commit que quitó academia_config.descuento_hermanos_pct) — una academia
// que lo quiera lo crea como descuento recurrente con intervalo "siempre".
export async function generarReciboParaFamilia(admin, {
  tenantId, familiaId, alumnosActivos, mes, anio, concepto, descuentosPorAlumno = {},
}) {
  let totalBruto = 0;
  let totalDescuento = 0;
  // Se guarda el % recurrente combinado de cada alumno en su línea (ver
  // insert de `lineas` abajo) para que la vista previa y el email puedan
  // mostrar qué descuento se aplicó a quién — antes solo se reflejaba en
  // el total, invisible para el admin.
  const recurrentePctPorAlumno = {};
  for (const a of alumnosActivos) {
    const bruto = Number(a.precio_bruto || 0);
    const recurrentesQueAplican = (descuentosPorAlumno[a.id] || []).filter((d) =>
      intervaloAplica(d.intervalo, { fechaAlta: a.fecha_alta, mes, anio })
    );
    recurrentePctPorAlumno[a.id] = combinarPorcentajes(recurrentesQueAplican);
    const { totalDescuento: descuentoAlumno } = calcularDescuento({
      totalBruto: bruto,
      descuentosRecurrentes: recurrentesQueAplican,
    });
    totalBruto += bruto;
    totalDescuento += descuentoAlumno;
  }
  totalDescuento = Math.round(totalDescuento * 100) / 100;
  const totalNeto = Math.round((totalBruto - totalDescuento) * 100) / 100;

  const { numero, error: numeroErr } = await siguienteNumeroRecibo(admin, tenantId, anio);
  if (numeroErr) return { ok: false, error: numeroErr };

  const { data: recibo, error: insertErr } = await admin
    .from("academia_recibos")
    .insert({
      tenant_id: tenantId,
      familia_id: familiaId,
      mes,
      anio,
      numero_recibo: numero,
      concepto,
      total_bruto: totalBruto,
      total_descuento: totalDescuento,
      total_neto: totalNeto,
    })
    .select("id")
    .single();
  if (insertErr) return { ok: false, error: insertErr };

  const lineas = alumnosActivos.map((a) => ({
    recibo_id: recibo.id,
    alumno_id: a.id,
    nombre_alumno: a.nombre,
    curso_alumno: a.curso,
    precio_bruto: a.precio_bruto,
    descripcion: concepto,
    descuento_recurrente_pct: recurrentePctPorAlumno[a.id] || 0,
  }));
  const { error: lineasErr } = await admin.from("academia_recibos_lineas").insert(lineas);
  if (lineasErr) return { ok: false, error: lineasErr };

  return { ok: true, reciboId: recibo.id };
}

// Borra un recibo (las líneas caen en cascada por FK) solo si sigue en
// borrador — un enviado nunca se toca. La usan tanto /regenerar como
// /:id/regenerar antes de volver a generarlo con generarReciboParaFamilia.
export async function eliminarReciboBorrador(admin, { tenantId, reciboId }) {
  const { data: recibo, error: fetchErr } = await admin
    .from("academia_recibos")
    .select("id, estado")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr };
  if (!recibo) return { ok: false, motivo: "Recibo no encontrado." };
  if (recibo.estado !== "borrador") return { ok: false, motivo: "Solo se pueden regenerar recibos en borrador." };

  const { error: delErr } = await admin
    .from("academia_recibos")
    .delete()
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (delErr) return { ok: false, error: delErr };
  return { ok: true };
}
