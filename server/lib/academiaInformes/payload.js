// Traduce academia_config a la forma que espera tutordigital-pdf-service
// (ver app.py / generators/recibo.py del microservicio) — mismo mapeo de
// columnas que academiaRecibos/plantillaEmail.js usa para el email de
// recibos (nombre_emisor → nombre, direccion_emisor → direccion, etc.).
export function buildAcademiaPayload(config = {}, tenantNombre = "") {
  const nombre = config.nombre_emisor || tenantNombre || "";
  const direccion = [config.direccion_emisor, config.cp_emisor, config.ciudad_emisor].filter(Boolean).join(", ");
  return {
    nombre,
    titular: nombre,
    nif: config.dni_emisor || "",
    direccion,
    telefono: config.telefono_emisor || "",
    email: config.email_emisor || "",
    logo_url: config.logo_url || "",
    texto_exencion: config.texto_exencion_iva || undefined,
  };
}

// Resumen del recibo de UN alumno (una línea de academia_recibos_lineas)
// en la forma que espera generators/recibo.py — el desglose de descuentos
// recurrentes ya viene calculado en euros por alumno (ver
// desglosarDescuentosRecurrentes en academiaRecibos/calculos.js), así que
// aquí solo se suma para sacar precio_neto y un descuento_pct combinado.
export function buildReciboPayload(linea, numeroRecibo, familia) {
  if (!linea) return null;
  const bruto = Number(linea.precio_bruto) || 0;
  const descuentoImporte = (linea.descuentos_recurrentes || []).reduce((sum, d) => sum + (Number(d.importe) || 0), 0);
  const neto = Math.round((bruto - descuentoImporte) * 100) / 100;
  const descuentoPct = bruto > 0 ? Math.round((descuentoImporte / bruto) * 10000) / 100 : 0;
  return {
    numero: numeroRecibo || "",
    precio_bruto: bruto,
    descuento_pct: descuentoPct,
    precio_neto: neto,
    familia: {
      nombre: familia?.nombre || "",
      dni: familia?.dni || "",
      direccion: familia?.direccion || "",
      codigo_postal: familia?.codigo_postal || "",
      ciudad: familia?.ciudad || "",
      metodo_pago: familia?.metodo_pago || "",
    },
  };
}
