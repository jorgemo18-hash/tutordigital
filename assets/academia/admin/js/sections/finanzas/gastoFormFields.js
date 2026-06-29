import { CATEGORIAS_GASTO, calcGasto } from "./calculos.js";
import { buildField } from "./campoField.js";

function buildCategoriaSelect(valorInicial) {
  const field = buildField("Categoría", "select");
  for (const c of CATEGORIAS_GASTO) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    field.input.appendChild(opt);
  }
  if (valorInicial && CATEGORIAS_GASTO.includes(valorInicial)) field.input.value = valorInicial;
  return field;
}

// Construye los campos del formulario de gasto + su cálculo reactivo de
// importe IVA/retención/total. `gastoInicial` (null en modo creación)
// precarga los valores en modo edición. Devuelve `wrap` (listo para
// insertar en el drawer), `validar()`, `leerValores()` y
// `rellenarDesdeOcr(datos)` — funciones que el drawer usa sin necesitar
// conocer la estructura interna de los campos.
export function buildGastoFormFields(gastoInicial = null) {
  const fecha = buildField("Fecha", "input", { type: "date", value: gastoInicial?.fecha || new Date().toISOString().slice(0, 10) });
  const proveedor = buildField("Proveedor", "input", { type: "text", value: gastoInicial?.proveedor || "" });
  const concepto = buildField("Concepto", "input", { type: "text", value: gastoInicial?.concepto || "" });
  const cif = buildField("CIF / NIF proveedor", "input", { type: "text", value: gastoInicial?.cif || "" });
  const categoria = buildCategoriaSelect(gastoInicial?.categoria);
  const baseImponible = buildField("Base imponible (€)", "input", { type: "number", min: "0", step: "0.01", value: gastoInicial?.base_imponible ?? "0" });
  const ivaPct = buildField("IVA (%)", "input", { type: "number", min: "0", step: "1", value: gastoInicial?.iva_pct ?? "21" });
  const importeIva = buildField("Importe IVA (€)", "input", { type: "number", readOnly: true, disabled: true });
  importeIva.input.classList.add("ac-tarifa-readonly");
  const retencionPct = buildField("Retención (%)", "input", { type: "number", min: "0", step: "1", value: gastoInicial?.retencion_pct ?? "0" });
  const importeRetencion = buildField("Importe retención (€)", "input", { type: "number", readOnly: true, disabled: true });
  importeRetencion.input.classList.add("ac-tarifa-readonly");
  const total = buildField("Total a pagar (€)", "input", { type: "number", readOnly: true, disabled: true });
  total.input.classList.add("ac-tarifa-readonly");
  const notas = buildField("Notas", "textarea", { rows: 2, value: gastoInicial?.notas || "" });

  let fotoUrlActual = gastoInicial?.foto_url || null;

  function refreshCalculo() {
    const { ivaImporte, retencionImporte, total: totalCalc } = calcGasto({
      baseImponible: baseImponible.input.value,
      ivaPct: ivaPct.input.value,
      retencionPct: retencionPct.input.value,
    });
    importeIva.input.value = ivaImporte.toFixed(2);
    importeRetencion.input.value = retencionImporte.toFixed(2);
    total.input.value = totalCalc.toFixed(2);
  }
  [baseImponible, ivaPct, retencionPct].forEach((f) => f.input.addEventListener("input", refreshCalculo));
  refreshCalculo();

  const fieldRow1 = document.createElement("div");
  fieldRow1.className = "ac-field-row";
  fieldRow1.append(fecha.wrap, proveedor.wrap);
  const fieldRow2 = document.createElement("div");
  fieldRow2.className = "ac-field-row";
  fieldRow2.append(cif.wrap, categoria.wrap);
  const fieldRow3 = document.createElement("div");
  fieldRow3.className = "ac-field-row";
  fieldRow3.append(baseImponible.wrap, ivaPct.wrap);
  const fieldRow4 = document.createElement("div");
  fieldRow4.className = "ac-field-row";
  fieldRow4.append(importeIva.wrap, retencionPct.wrap);

  const wrap = document.createElement("div");
  wrap.append(fieldRow1, concepto.wrap, fieldRow2, fieldRow3, fieldRow4, importeRetencion.wrap, total.wrap, notas.wrap);

  function validar() {
    if (!proveedor.input.value.trim() || !concepto.input.value.trim()) {
      return "Proveedor y concepto son obligatorios.";
    }
    return null;
  }

  function leerValores() {
    const valores = {
      fecha: fecha.input.value,
      proveedor: proveedor.input.value.trim(),
      concepto: concepto.input.value.trim(),
      cif: cif.input.value.trim(),
      categoria: categoria.input.value,
      base_imponible: Number(baseImponible.input.value) || 0,
      iva_pct: Number(ivaPct.input.value) || 0,
      retencion_pct: Number(retencionPct.input.value) || 0,
      notas: notas.input.value.trim(),
    };
    if (fotoUrlActual) valores.foto_url = fotoUrlActual;
    return valores;
  }

  // Solo se rellenan los campos editables del formulario; importe_iva/
  // importe_retencion/total_a_pagar que también devuelve el OCR no se
  // usan directamente porque esos tres son siempre calculados
  // (refreshCalculo) a partir de base/IVA%/retención%, nunca editables.
  function rellenarDesdeOcr(datos) {
    if (datos.fecha) fecha.input.value = datos.fecha;
    if (datos.proveedor) proveedor.input.value = datos.proveedor;
    if (datos.cif) cif.input.value = datos.cif;
    if (datos.concepto) concepto.input.value = datos.concepto;
    if (datos.categoria && CATEGORIAS_GASTO.includes(datos.categoria)) categoria.input.value = datos.categoria;
    if (datos.base_imponible != null) baseImponible.input.value = datos.base_imponible;
    if (datos.iva_pct != null) ivaPct.input.value = datos.iva_pct;
    if (datos.retencion_pct != null) retencionPct.input.value = datos.retencion_pct;
    if (datos.foto_url) fotoUrlActual = datos.foto_url;
    refreshCalculo();
  }

  return { wrap, validar, leerValores, rellenarDesdeOcr };
}
