import { CATEGORIAS_GASTO, calcGastoDesdeImporte } from "./calculos.js";
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

// IVA% como selector de valores típicos — por defecto 0%, el tipo más común
// en gastos de una academia (servicios exentos, personal, alquiler...).
function buildIvaPctSelect(valorInicial) {
  const field = buildField("IVA %", "select");
  for (const pct of [0, 4, 10, 21]) {
    const opt = document.createElement("option");
    opt.value = String(pct);
    opt.textContent = `${pct}%`;
    field.input.appendChild(opt);
  }
  field.input.value = String(valorInicial ?? 0);
  return field;
}

function buildCamposComunes(gastoInicial) {
  return {
    fecha:     buildField("Fecha", "input", { type: "date", value: gastoInicial?.fecha || new Date().toISOString().slice(0, 10) }),
    proveedor: buildField("Proveedor", "input", { type: "text", value: gastoInicial?.proveedor || "" }),
    concepto:  buildField("Concepto", "input", { type: "text", value: gastoInicial?.concepto || "" }),
    cif:       buildField("CIF / NIF proveedor", "input", { type: "text", value: gastoInicial?.cif || "" }),
    categoria: buildCategoriaSelect(gastoInicial?.categoria),
    notas:     buildField("Notas", "textarea", { rows: 2, value: gastoInicial?.notas || "" }),
  };
}

function buildFilaCalculada() {
  const baseImponible = buildField("Base imponible (€)", "input", { type: "number", readOnly: true, disabled: true });
  baseImponible.input.classList.add("ac-tarifa-readonly");
  const ivaImporte = buildField("IVA (€)", "input", { type: "number", readOnly: true, disabled: true });
  ivaImporte.input.classList.add("ac-tarifa-readonly");

  const fila = document.createElement("div");
  fila.className = "ac-field-row hidden";
  fila.append(baseImponible.wrap, ivaImporte.wrap);

  return { fila, baseImponible, ivaImporte };
}

// Formulario de gasto — un único modo siempre visible: Importe total +
// selector IVA%. Si el IVA% es distinto de 0, se muestran automáticamente
// (solo lectura) la base imponible y el IVA€ derivados del total; con 0%
// no hay nada que desglosar y esa fila queda oculta.
export function buildGastoFormFields(gastoInicial = null) {
  const comunes = buildCamposComunes(gastoInicial);
  const ivaPct = buildIvaPctSelect(gastoInicial?.iva_pct);
  const importeTotal = buildField("Importe total (€)", "input", {
    type: "number", min: "0", step: "0.01",
    value: gastoInicial?.importe ?? "0",
  });
  const { fila: filaCalculada, baseImponible, ivaImporte } = buildFilaCalculada();

  function refreshCalculo() {
    const { baseImponible: base, ivaImporte: iva } = calcGastoDesdeImporte({
      importe: importeTotal.input.value,
      ivaPct: ivaPct.input.value,
    });
    filaCalculada.classList.toggle("hidden", base == null);
    if (base == null) return;
    baseImponible.input.value = base.toFixed(2);
    ivaImporte.input.value = iva.toFixed(2);
  }
  [importeTotal, ivaPct].forEach((f) => f.input.addEventListener("input", refreshCalculo));
  ivaPct.input.addEventListener("change", refreshCalculo);
  refreshCalculo();

  const fieldRow1 = document.createElement("div");
  fieldRow1.className = "ac-field-row";
  fieldRow1.append(comunes.fecha.wrap, comunes.proveedor.wrap);
  const fieldRow2 = document.createElement("div");
  fieldRow2.className = "ac-field-row";
  fieldRow2.append(comunes.cif.wrap, comunes.categoria.wrap);
  const fieldRow3 = document.createElement("div");
  fieldRow3.className = "ac-field-row";
  fieldRow3.append(ivaPct.wrap, importeTotal.wrap);

  const wrap = document.createElement("div");
  wrap.append(fieldRow1, comunes.concepto.wrap, fieldRow2, fieldRow3, filaCalculada, comunes.notas.wrap);

  function validar() {
    if (!comunes.proveedor.input.value.trim() || !comunes.concepto.input.value.trim()) {
      return "Proveedor y concepto son obligatorios.";
    }
    return null;
  }

  function leerValores() {
    return {
      fecha:     comunes.fecha.input.value,
      proveedor: comunes.proveedor.input.value.trim(),
      concepto:  comunes.concepto.input.value.trim(),
      cif:       comunes.cif.input.value.trim(),
      categoria: comunes.categoria.input.value,
      notas:     comunes.notas.input.value.trim(),
      importe:   Number(importeTotal.input.value) || 0,
      iva_pct:   Number(ivaPct.input.value) || 0,
    };
  }

  // El OCR extrae total_a_pagar (importe) e iva_pct de la factura — se
  // redondea el IVA% detectado al valor más cercano del selector (0/4/10/21).
  function rellenarDesdeOcr(datos) {
    if (datos.fecha)     comunes.fecha.input.value     = datos.fecha;
    if (datos.proveedor) comunes.proveedor.input.value = datos.proveedor;
    if (datos.cif)       comunes.cif.input.value       = datos.cif;
    if (datos.concepto)  comunes.concepto.input.value  = datos.concepto;
    if (datos.categoria && CATEGORIAS_GASTO.includes(datos.categoria)) comunes.categoria.input.value = datos.categoria;
    if (datos.total_a_pagar != null) importeTotal.input.value = datos.total_a_pagar;
    if (datos.iva_pct != null) {
      const cercano = [0, 4, 10, 21].reduce((a, b) => Math.abs(b - datos.iva_pct) < Math.abs(a - datos.iva_pct) ? b : a);
      ivaPct.input.value = String(cercano);
    }
    refreshCalculo();
  }

  return { wrap, validar, leerValores, rellenarDesdeOcr };
}
