import {
  calcularDescuento, desglosarDescuentosRecurrentes, descuentoDeTarifa, intervaloAplica, round2,
  siguienteNumeroRecibo,
} from "./calculos.js";

// Crea un recibo + sus líneas para una familia concreta. No comprueba si ya
// existe uno para ese período — eso lo decide el llamador (generar.routes.js)
// antes de invocarla, tanto para la primera generación como para regenerar.
// `descuentosPorAlumno` (alumno_id -> [{concepto, porcentaje, acumulable,
// intervalo}]) trae solo los descuentos recurrentes ACTIVOS de cada
// alumno — el filtro por intervalo vs su fecha_alta se hace aquí, alumno a
// alumno, porque cada uno puede tener un fecha_alta y unos descuentos
// distintos.
// El descuento de hermanos automático desapareció (ver docs/cambios o el
// commit que quitó academia_config.descuento_hermanos_pct) — una academia
// que lo quiera lo crea como descuento recurrente con intervalo "siempre".
// `descuentoPuntualPct`/`descuentoPuntualNota`: ajuste manual (no
// recurrente) que el admin hubiera guardado en el recibo que se está
// regenerando — el llamador (generar.routes.js) los lee del recibo
// anterior antes de borrarlo y los reenvía aquí, para no perder un ajuste
// hecho a mano solo porque se recalculó el recibo.
// `numeroReciboPrevio`: número del recibo que se está REGENERANDO. Regenerar
// es borrar y recrear, y sin esto el recibo nuevo pedía número a la serie —
// lo que emitía un segundo documento con número distinto para el mismo mes y
// la misma familia (y, con el contador anterior basado en count, llegaba a
// repetir uno ya emitido). Un recibo regenerado es el MISMO documento
// recalculado: conserva su número. Mismo mecanismo por el que ya se
// preservaba descuento_puntual_pct (ver generar.routes.js).
export async function generarReciboParaFamilia(admin, {
  tenantId, familiaId, alumnosActivos, mes, anio, concepto, descuentosPorAlumno = {},
  descuentoPuntualPct = 0, descuentoPuntualNota = null, numeroReciboPrevio = null,
}) {
  let totalBruto = 0;
  let recurrenteImporteTotal = 0;
  // Se guarda el desglose de descuentos recurrentes (concepto, % e importe
  // de cada uno) en la línea de cada alumno (ver insert de `lineas` abajo)
  // para que la vista previa y el email puedan mostrar una fila por cada
  // descuento aplicado, con su propio importe — antes solo se reflejaba un
  // % combinado en el total, sin desglose visible para el admin.
  const desglosePorAlumno = {};
  for (const a of alumnosActivos) {
    const bruto = Number(a.precio_bruto || 0);
    const recurrentesQueAplican = (descuentosPorAlumno[a.id] || []).filter((d) =>
      intervaloAplica(d.intervalo, { fechaAlta: a.fecha_alta, mes, anio })
    );
    // El descuento propio de la tarifa del alumno va PRIMERO en el desglose
    // y siempre: no compite con los acumulables del catálogo, es parte del
    // precio pactado con esa familia (ver descuentoDeTarifa en calculos.js).
    // Antes no llegaba hasta aquí y el recibo cobraba el bruto entero
    // mientras la lista de alumnos mostraba el precio ya descontado.
    const deTarifa = descuentoDeTarifa(bruto, a.descuento_tarifa_pct);
    const desglose = [
      ...(deTarifa ? [deTarifa] : []),
      ...desglosarDescuentosRecurrentes(recurrentesQueAplican, bruto),
    ];
    desglosePorAlumno[a.id] = desglose;
    totalBruto += bruto;
    recurrenteImporteTotal += desglose.reduce((suma, d) => suma + d.importe, 0);
  }
  recurrenteImporteTotal = round2(recurrenteImporteTotal);
  const { totalDescuento, totalNeto } = calcularDescuento({
    totalBruto,
    descuentoPuntualPct,
    descuentoRecurrenteImporte: recurrenteImporteTotal,
  });

  let numero = numeroReciboPrevio;
  if (!numero) {
    const { numero: nuevo, error: numeroErr } = await siguienteNumeroRecibo(admin, tenantId, anio);
    if (numeroErr) return { ok: false, error: numeroErr };
    numero = nuevo;
  }

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
      descuento_puntual_pct: descuentoPuntualPct,
      descuento_puntual_nota: descuentoPuntualNota,
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
    descuentos_recurrentes: desglosePorAlumno[a.id] || [],
  }));
  const { error: lineasErr } = await admin.from("academia_recibos_lineas").insert(lineas);
  if (lineasErr) return { ok: false, error: lineasErr };

  return { ok: true, reciboId: recibo.id };
}

// Borra un recibo (las líneas caen en cascada por FK) sin mirar su estado —
// si un enviado/pagado puede borrarse sin pedir confirmación ya lo decidió
// el llamador (generar.routes.js, política forward-only: nunca se
// sobrescribe un enviado en silencio). La usan tanto /regenerar como
// /:id/regenerar antes de volver a generarlo con generarReciboParaFamilia.
export async function eliminarRecibo(admin, { tenantId, reciboId }) {
  const { error: delErr } = await admin
    .from("academia_recibos")
    .delete()
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (delErr) return { ok: false, error: delErr };
  return { ok: true };
}
