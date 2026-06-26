import { calcularDescuento, siguienteNumeroRecibo } from "./calculos.js";

// Crea un recibo + sus líneas para una familia concreta. No comprueba si ya
// existe uno para ese período — eso lo decide el llamador (generar.routes.js)
// antes de invocarla, tanto para la primera generación como para regenerar.
export async function generarReciboParaFamilia(admin, { tenantId, familiaId, alumnosActivos, mes, anio, concepto, descuentoHermanosPct }) {
  const totalBruto = alumnosActivos.reduce((sum, a) => sum + Number(a.precio_bruto || 0), 0);
  const { totalDescuento, totalNeto } = calcularDescuento({ totalBruto, descuentoHermanosPct, descuentoPuntualPct: 0 });

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
      descuento_hermanos_pct: descuentoHermanosPct,
      descuento_puntual_pct: 0,
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
