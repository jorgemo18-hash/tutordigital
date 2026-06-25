import { buildReciboHtml } from "./academiaReciboTemplate.js";
import { sendReciboEmail } from "./email.js";

export const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatearConcepto(plantilla, mes, anio, academiaNombre = "") {
  const base = plantilla || "Clases {mes} {año}";
  return base
    .split("{mes}").join(MESES[mes] || "")
    .split("{año}").join(String(anio))
    .split("{academia}").join(academiaNombre);
}

// Hermanos y descuento puntual se aplican como dos porcentajes sumados
// sobre el bruto, no encadenados — más fácil de explicar en el recibo.
export function calcularDescuento({ totalBruto, descuentoHermanosPct = 0, descuentoPuntualPct = 0 }) {
  const bruto = Number(totalBruto) || 0;
  const pctTotal = (Number(descuentoHermanosPct) || 0) + (Number(descuentoPuntualPct) || 0);
  const totalDescuento = Math.round(bruto * (pctTotal / 100) * 100) / 100;
  const totalNeto = Math.round((bruto - totalDescuento) * 100) / 100;
  return { totalDescuento, totalNeto };
}

export async function siguienteNumeroRecibo(admin, tenantId, anio) {
  const { count, error } = await admin
    .from("academia_recibos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) return { error };
  const contador = String((count || 0) + 1).padStart(3, "0");
  return { numero: `REC-${anio}-${contador}` };
}

// Familias activas del tenant + sus alumnos activos con el precio_bruto de
// la tarifa vigente de cada uno — base tanto para GET (listado) como para
// POST /generar (cálculo de totales).
export async function fetchFamiliasConAlumnos(admin, tenantId) {
  const [{ data: familias, error: famErr }, { data: alumnos, error: alErr }] = await Promise.all([
    admin
      .from("academia_familias")
      .select("id, nombre, email, metodo_pago")
      .eq("tenant_id", tenantId)
      .eq("activa", true)
      .order("nombre", { ascending: true }),
    admin
      .from("academia_alumnos")
      .select("id, nombre, curso, familia_id")
      .eq("tenant_id", tenantId)
      .eq("activo", true),
  ]);
  if (famErr || alErr) return { error: famErr || alErr };

  const alumnoIds = (alumnos || []).map((a) => a.id);
  let tarifaPorAlumno = {};
  if (alumnoIds.length) {
    const { data: tarifas, error: tarifaErr } = await admin
      .from("academia_tarifas")
      .select("alumno_id, precio_bruto")
      .eq("tenant_id", tenantId)
      .in("alumno_id", alumnoIds)
      .is("fecha_fin", null);
    if (tarifaErr) return { error: tarifaErr };
    tarifaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, t.precio_bruto]));
  }

  const alumnosPorFamilia = {};
  for (const a of alumnos || []) {
    if (!a.familia_id) continue;
    const item = { id: a.id, nombre: a.nombre, curso: a.curso, precio_bruto: Number(tarifaPorAlumno[a.id] || 0) };
    (alumnosPorFamilia[a.familia_id] ||= []).push(item);
  }

  const items = (familias || []).map((familia) => ({
    familia,
    alumnosActivos: alumnosPorFamilia[familia.id] || [],
  }));
  return { items };
}

export async function fetchRecibosDelMes(admin, tenantId, { mes, anio }) {
  const { data, error } = await admin
    .from("academia_recibos")
    .select("id, familia_id, numero_recibo, concepto, estado, total_neto, fecha_envio")
    .eq("tenant_id", tenantId)
    .eq("mes", mes)
    .eq("anio", anio);
  if (error) return { error };
  return { porFamilia: Object.fromEntries((data || []).map((r) => [r.familia_id, r])) };
}

export async function fetchReciboCompleto(admin, tenantId, reciboId) {
  const { data: recibo, error: reciboErr } = await admin
    .from("academia_recibos")
    .select("*, familia:academia_familias(id, nombre, email, metodo_pago)")
    .eq("id", reciboId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reciboErr) return { error: reciboErr };
  if (!recibo) return { data: null };

  const { data: lineas, error: lineasErr } = await admin
    .from("academia_recibos_lineas")
    .select("id, alumno_id, nombre_alumno, curso_alumno, precio_bruto, descripcion")
    .eq("recibo_id", reciboId)
    .order("nombre_alumno", { ascending: true });
  if (lineasErr) return { error: lineasErr };

  return { data: { ...recibo, lineas: lineas || [] } };
}

// Envía un recibo ya generado: construye el HTML, lo manda por Resend y
// marca estado=enviado. La usan tanto el envío individual como el masivo,
// para no duplicar esta lógica entre ambas rutas.
export async function enviarReciboPorId(admin, { tenantId, reciboId, tenantNombre, config }) {
  const { data: recibo, error } = await fetchReciboCompleto(admin, tenantId, reciboId);
  if (error) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el recibo." };
  if (!recibo) return { ok: false, code: "not_found", motivo: "Recibo no encontrado." };
  if (!recibo.familia?.email) {
    return {
      ok: false,
      code: "sin_email",
      motivo: "La familia no tiene email configurado.",
      familiaNombre: recibo.familia?.nombre || "",
    };
  }

  const html = buildReciboHtml({ recibo, familia: recibo.familia, lineas: recibo.lineas, config, tenantNombre });
  try {
    await sendReciboEmail({ to: recibo.familia.email, subject: `${recibo.concepto} — ${tenantNombre}`, html });
  } catch (err) {
    return { ok: false, code: "send_failed", motivo: err.message || "Fallo al enviar el email.", familiaNombre: recibo.familia.nombre };
  }

  const { error: updateErr } = await admin
    .from("academia_recibos")
    .update({ estado: "enviado", fecha_envio: new Date().toISOString() })
    .eq("id", reciboId)
    .eq("tenant_id", tenantId);
  if (updateErr) {
    return { ok: false, code: "update_failed", motivo: "El email se envió pero no se pudo actualizar el estado.", familiaNombre: recibo.familia.nombre };
  }
  return { ok: true };
}
