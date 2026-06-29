import { formatEuros } from "../casillaRow.js";

// "Descargar todos" no tiene una página en vivo de la que leer los
// valores actuales (cada modelo se imprime en su propia ventana, sin
// formulario montado) — por eso aquí se repite, en su versión más
// simple, la misma fórmula de cascada+override que ya usa cada
// modeloXXX.js en su refrescar(). Si esa fórmula cambia ahí, hay que
// cambiarla aquí también.
function combinar(override, porDefecto) {
  return override ?? porDefecto;
}

export function prepararDatos130(datos) {
  const { calculado = { ingresos: 0, gastos_deducibles: 0 }, editable = {}, overrides = {} } = datos;
  const ingresos = combinar(overrides.ingresos, calculado.ingresos);
  const gastosDeducibles = combinar(overrides.gastos_deducibles, calculado.gastos_deducibles);
  const rendimientoNeto = combinar(overrides.rendimiento_neto, ingresos - gastosDeducibles);
  const veintePct = combinar(overrides.veinte_pct, Math.max(0, rendimientoNeto * 0.2));
  const minoracion = editable.minoracion ?? 0;
  const resultado = combinar(overrides.resultado, veintePct - minoracion);
  return {
    filas: [
      { numero: "01", label: "Ingresos computables del período", valor: formatEuros(ingresos) },
      { numero: "02", label: "Gastos fiscalmente deducibles", valor: formatEuros(gastosDeducibles) },
      { numero: "03", label: "Rendimiento neto", valor: formatEuros(rendimientoNeto) },
      { numero: "04", label: "20% de la casilla 03", valor: formatEuros(veintePct) },
      { numero: "06", label: "Minoración", valor: formatEuros(minoracion) },
      { numero: "07", label: "Resultado", valor: formatEuros(resultado) },
    ],
    resultado,
  };
}

export function prepararDatos202(datos) {
  const { editable = {}, overrides = {} } = datos;
  const baseImponible = editable.base_imponible ?? 0;
  const tipoGravamen = editable.tipo_gravamen ?? 25;
  const cuotaIntegra = combinar(overrides.cuota_integra, baseImponible * (tipoGravamen / 100));
  const pagosAnteriores = editable.pagos_fraccionados_anteriores ?? 0;
  const resultado = combinar(overrides.resultado, cuotaIntegra - pagosAnteriores);
  return {
    filas: [
      { numero: "01", label: "Base imponible del período", valor: formatEuros(baseImponible) },
      { numero: "02", label: "Tipo de gravamen", valor: `${tipoGravamen}%` },
      { numero: "03", label: "Cuota íntegra", valor: formatEuros(cuotaIntegra) },
      { numero: "04", label: "Pagos fraccionados anteriores del ejercicio", valor: formatEuros(pagosAnteriores) },
      { numero: "05", label: "Resultado", valor: formatEuros(resultado) },
    ],
    resultado,
  };
}

const IVA_PCT_115 = 21;

export function prepararDatos115(datos) {
  const { editable = {}, overrides = {} } = datos;
  const base = editable.base_mensual ?? 0;
  const retencionPct = editable.retencion_pct ?? 19;
  const iva = combinar(overrides.iva, base * (IVA_PCT_115 / 100));
  const retencionImporte = base * (retencionPct / 100);
  const total = combinar(overrides.total, base + iva - retencionImporte);
  const baseTrim = combinar(overrides.base_trimestral, base * 3);
  const retencionTrim = combinar(overrides.retencion_trimestral, retencionImporte * 3);
  return {
    filas: [
      { numero: null, label: "Base mensual alquiler", valor: formatEuros(base) },
      { numero: null, label: `IVA ${IVA_PCT_115}%`, valor: formatEuros(iva) },
      { numero: null, label: "Retención", valor: `${retencionPct}%` },
      { numero: null, label: "Importe retención", valor: formatEuros(retencionImporte) },
      { numero: null, label: "Total a pagar propietario", valor: formatEuros(total) },
      { numero: null, label: "Base trimestral (× 3)", valor: formatEuros(baseTrim) },
      { numero: null, label: "Retención trimestral (× 3)", valor: formatEuros(retencionTrim) },
    ],
    resultado: retencionTrim,
    anexoData: { base, iva, retencion: retencionImporte, total, baseTrim, retencionTrim },
  };
}

export function prepararDatos111(datos) {
  const { editable = {}, overrides = {} } = datos;
  const base = editable.base_trimestral ?? 0;
  const retencionPct = editable.retencion_pct ?? 15;
  const retencionTrimestral = combinar(overrides.retencion_trimestral, base * (retencionPct / 100));
  return {
    filas: [
      { numero: null, label: "Base trimestral nóminas", valor: formatEuros(base) },
      { numero: null, label: "Retención", valor: `${retencionPct}%` },
      { numero: null, label: "Retención trimestral", valor: formatEuros(retencionTrimestral) },
    ],
    resultado: retencionTrimestral,
    anexoData: { baseTrimestral: base, retencionPct, retencionTrimestral },
  };
}
