import { intervaloAplica, desglosarDescuentosRecurrentes, calcularDescuento, round2 } from "./calculos.js";
import { fetchDescuentosActivosPorAlumno } from "../academiaDescuentos/consultas.js";

// Vista previa económica de una familia — "cuánto pagaría si se generase un
// recibo hoy", reutilizando las mismas funciones que
// generarReciboParaFamilia() (nunca una reimplementación paralela del
// cálculo): mismo desglose de descuentos recurrentes por alumno, mismo
// calcularDescuento a nivel familia, mismo round2. Solo difiere en que no
// persiste nada — es una proyección con la tarifa y los descuentos VIGENTES
// ahora mismo, evaluada contra el mes/año actuales (de los que depende
// intervaloAplica para "primer mes"/"primer trimestre").
//
// Se recibe `familiaId` directo (no un alumnoId a resolver) para que el
// drawer de alumno pueda pedir la foto económica de la familia que el admin
// tiene seleccionada AHORA MISMO en el formulario — incluso si todavía no
// la ha guardado (Tarea 2, cambio de familia): si resolviéramos por
// alumnoId, un cambio de familia sin guardar seguiría devolviendo la
// familia antigua, porque en servidor no ha cambiado nada todavía.
//
// No toca academia_recibos_lineas en ningún punto — el listado de "quién es
// de la familia" sale de academia_alumnos (activo=true), nunca de líneas de
// recibo, así que el caso de una línea huérfana con alumno_id NULL (ver
// TUTORDIGITAL-BACKEND-5) no puede darse aquí: no hay ningún punto del
// cálculo que lea esa columna.
export async function fetchEconomicoFamilia(admin, tenantId, familiaId, { hoy = new Date() } = {}) {
  const { data: familia, error: familiaErr } = await admin
    .from("academia_familias")
    .select("id, nombre")
    .eq("id", familiaId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (familiaErr) return { error: familiaErr };
  if (!familia) return { data: null };

  const { data: alumnos, error: alumnosErr } = await admin
    .from("academia_alumnos")
    .select("id, nombre, fecha_alta")
    .eq("tenant_id", tenantId)
    .eq("familia_id", familiaId)
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (alumnosErr) return { error: alumnosErr };

  const alumnoIds = (alumnos || []).map((a) => a.id);
  const [{ data: tarifas, error: tarifasErr }, { porAlumno: descuentosPorAlumno, error: descErr }] = await Promise.all([
    alumnoIds.length
      ? admin.from("academia_tarifas").select("alumno_id, precio_bruto, precio_neto").eq("tenant_id", tenantId).in("alumno_id", alumnoIds).is("fecha_fin", null)
      : Promise.resolve({ data: [] }),
    fetchDescuentosActivosPorAlumno(admin, tenantId, alumnoIds),
  ]);
  if (tarifasErr || descErr) return { error: tarifasErr || descErr };

  const tarifaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, t]));
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();

  let totalBruto = 0;
  let recurrenteImporteTotal = 0;
  const alumnosConCalculo = (alumnos || []).map((a) => {
    const tarifa = tarifaPorAlumno[a.id] || null;
    const bruto = Number(tarifa?.precio_bruto || 0);
    const recurrentesQueAplican = (descuentosPorAlumno[a.id] || []).filter((d) =>
      intervaloAplica(d.intervalo, { fechaAlta: a.fecha_alta, mes, anio })
    );
    const desglose = desglosarDescuentosRecurrentes(recurrentesQueAplican, bruto);
    const descuentoImporte = round2(desglose.reduce((suma, d) => suma + d.importe, 0));
    totalBruto += bruto;
    recurrenteImporteTotal += descuentoImporte;
    return {
      id: a.id,
      nombre: a.nombre,
      tarifa: tarifa ? { precio_bruto: bruto, precio_neto: Number(tarifa.precio_neto) || 0 } : null,
      descuentos: desglose,
      subtotalNeto: round2(bruto - descuentoImporte),
    };
  });
  recurrenteImporteTotal = round2(recurrenteImporteTotal);

  const { totalDescuento, totalNeto } = calcularDescuento({ totalBruto, descuentoRecurrenteImporte: recurrenteImporteTotal });

  return {
    data: {
      familia,
      alumnos: alumnosConCalculo,
      totalBruto: round2(totalBruto),
      totalDescuento,
      totalNeto,
      mes,
      anio,
    },
  };
}
