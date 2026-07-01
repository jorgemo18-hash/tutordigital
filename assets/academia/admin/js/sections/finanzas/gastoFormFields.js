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

// IVA% como selector de valores típicos (0/4/10/21%) — solo en modo
// desglose_iva=true, donde el tipo de IVA es semánticamente significativo.
function buildIvaPctSelect(valorInicial) {
  const field = buildField("IVA %", "select");
  for (const pct of [0, 4, 10, 21]) {
    const opt = document.createElement("option");
    opt.value = String(pct);
    opt.textContent = `${pct}%`;
    field.input.appendChild(opt);
  }
  field.input.value = String(valorInicial ?? 21);
  return field;
}

// Campos comunes a ambos modos — proveedor, concepto, categoría, fecha, cif.
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

// Modo desglose_iva=false: un único campo "Importe total" —
// base_imponible/iva_pct/iva_importe quedan en null en BD.
function buildModoSimple(gastoInicial) {
  const comunes = buildCamposComunes(gastoInicial);
  const importeTotal = buildField("Importe total (€)", "input", {
    type: "number", min: "0", step: "0.01",
    value: gastoInicial?.importe ?? "0",
  });

  const fieldRow1 = document.createElement("div");
  fieldRow1.className = "ac-field-row";
  fieldRow1.append(comunes.fecha.wrap, comunes.proveedor.wrap);
  const fieldRow2 = document.createElement("div");
  fieldRow2.className = "ac-field-row";
  fieldRow2.append(comunes.cif.wrap, comunes.categoria.wrap);

  const wrap = document.createElement("div");
  wrap.append(fieldRow1, comunes.concepto.wrap, fieldRow2, importeTotal.wrap, comunes.notas.wrap);

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
    };
  }

  function rellenarDesdeOcr(datos) {
    if (datos.fecha)     comunes.fecha.input.value     = datos.fecha;
    if (datos.proveedor) comunes.proveedor.input.value = datos.proveedor;
    if (datos.cif)       comunes.cif.input.value       = datos.cif;
    if (datos.concepto)  comunes.concepto.input.value  = datos.concepto;
    if (datos.categoria && CATEGORIAS_GASTO.includes(datos.categoria)) comunes.categoria.input.value = datos.categoria;
    // El OCR puede devolver importe directamente o base+iva; usamos importe si está presente.
    if (datos.importe != null) importeTotal.input.value = datos.importe;
    else if (datos.base_imponible != null) importeTotal.input.value = datos.base_imponible;
  }

  return { wrap, validar, leerValores, rellenarDesdeOcr };
}

// Modo desglose_iva=true: base + IVA% (selector) + IVA€ (calculado) +
// Total (calculado). Sin campos de retención (fuera del alcance de IVA).
// Total = base + iva (se guarda en `importe` vía calcularImportes backend,
// con retencion_pct=0 implícito).
function buildModoDesglose(gastoInicial) {
  const comunes = buildCamposComunes(gastoInicial);
  const baseImponible = buildField("Base imponible (€)", "input", {
    type: "number", min: "0", step: "0.01",
    value: gastoInicial?.base_imponible ?? "0",
  });
  const ivaPct = buildIvaPctSelect(gastoInicial?.iva_pct);
  const importeIva = buildField("IVA (€)", "input", { type: "number", readOnly: true, disabled: true });
  importeIva.input.classList.add("ac-tarifa-readonly");
  const total = buildField("Total (€)", "input", { type: "number", readOnly: true, disabled: true });
  total.input.classList.add("ac-tarifa-readonly");

  function refreshCalculo() {
    const { ivaImporte, total: totalCalc } = calcGasto({
      baseImponible: baseImponible.input.value,
      ivaPct: ivaPct.input.value,
      retencionPct: 0,
    });
    importeIva.input.value = ivaImporte.toFixed(2);
    total.input.value = totalCalc.toFixed(2);
  }
  [baseImponible, ivaPct].forEach((f) => f.input.addEventListener("input", refreshCalculo));
  // Disparar también en 'change' para el select
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
  fieldRow3.append(baseImponible.wrap, ivaPct.wrap);
  const fieldRow4 = document.createElement("div");
  fieldRow4.className = "ac-field-row";
  fieldRow4.append(importeIva.wrap, total.wrap);

  const wrap = document.createElement("div");
  wrap.append(fieldRow1, comunes.concepto.wrap, fieldRow2, fieldRow3, fieldRow4, comunes.notas.wrap);

  function validar() {
    if (!comunes.proveedor.input.value.trim() || !comunes.concepto.input.value.trim()) {
      return "Proveedor y concepto son obligatorios.";
    }
    return null;
  }

  function leerValores() {
    return {
      fecha:          comunes.fecha.input.value,
      proveedor:      comunes.proveedor.input.value.trim(),
      concepto:       comunes.concepto.input.value.trim(),
      cif:            comunes.cif.input.value.trim(),
      categoria:      comunes.categoria.input.value,
      notas:          comunes.notas.input.value.trim(),
      base_imponible: Number(baseImponible.input.value) || 0,
      iva_pct:        Number(ivaPct.input.value) || 0,
    };
  }

  function rellenarDesdeOcr(datos) {
    if (datos.fecha)     comunes.fecha.input.value     = datos.fecha;
    if (datos.proveedor) comunes.proveedor.input.value = datos.proveedor;
    if (datos.cif)       comunes.cif.input.value       = datos.cif;
    if (datos.concepto)  comunes.concepto.input.value  = datos.concepto;
    if (datos.categoria && CATEGORIAS_GASTO.includes(datos.categoria)) comunes.categoria.input.value = datos.categoria;
    if (datos.base_imponible != null) baseImponible.input.value = datos.base_imponible;
    if (datos.iva_pct != null) {
      // Redondear al valor más cercano del selector (0/4/10/21)
      const cercano = [0, 4, 10, 21].reduce((a, b) => Math.abs(b - datos.iva_pct) < Math.abs(a - datos.iva_pct) ? b : a);
      ivaPct.input.value = String(cercano);
    }
    refreshCalculo();
  }

  return { wrap, validar, leerValores, rellenarDesdeOcr };
}

// Punto de entrada: elige el modo según desglose_iva y delega.
// La firma pública (wrap, validar, leerValores, rellenarDesdeOcr) es
// idéntica en ambos modos — gastoDrawer.js no distingue cuál se usó.
export function buildGastoFormFields(gastoInicial = null, { desgloseIva = false } = {}) {
  return desgloseIva
    ? buildModoDesglose(gastoInicial)
    : buildModoSimple(gastoInicial);
}
