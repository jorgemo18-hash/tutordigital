// Traduce un recibo completo (ver fetchReciboCompleto en
// academiaRecibos/consultas.js) a la forma que espera el endpoint
// POST /recibo de tutordigital-pdf-service — modelo real multi-alumno
// (concepto + lineas[] + descuento puntual de familia + descuento de
// hermanos histórico), no el de un solo alumno que usaba el PDF embebido
// en /informe.
export function buildReciboPdfPayload(recibo) {
  return {
    concepto: recibo.concepto,
    numero_recibo: recibo.numero_recibo,
    mes: recibo.mes,
    anio: recibo.anio,
    created_at: recibo.created_at,
    familia: {
      nombre: recibo.familia?.nombre || "",
      dni: recibo.familia?.dni || "",
      direccion: recibo.familia?.direccion || "",
      codigo_postal: recibo.familia?.codigo_postal || "",
      ciudad: recibo.familia?.ciudad || "",
      metodo_pago: recibo.familia?.metodo_pago || "",
    },
    lineas: (recibo.lineas || []).map((l) => ({
      nombre_alumno: l.nombre_alumno,
      curso_alumno: l.curso_alumno || "",
      precio_bruto: Number(l.precio_bruto) || 0,
      descripcion: l.descripcion || "",
      descuentos_recurrentes: (l.descuentos_recurrentes || []).map((d) => ({
        concepto: d.concepto,
        porcentaje: Number(d.porcentaje) || 0,
        importe: Number(d.importe) || 0,
      })),
    })),
    descuento_puntual_pct: Number(recibo.descuento_puntual_pct) || 0,
    descuento_puntual_nota: recibo.descuento_puntual_nota || null,
    descuento_hermanos_pct: Number(recibo.descuento_hermanos_pct) || 0,
    total_bruto: Number(recibo.total_bruto) || 0,
    total_descuento: Number(recibo.total_descuento) || 0,
    total_neto: Number(recibo.total_neto) || 0,
  };
}
