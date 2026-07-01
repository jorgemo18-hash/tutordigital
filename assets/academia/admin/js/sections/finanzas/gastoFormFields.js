import { CATEGORIAS_GASTO, calcGastoDesdeImporte } from "./calculos.js";
import { buildField } from "./campoField.js";

// Sin 0% — ese caso es justo "no desglosar" (toggle desactivado).
const IVA_PCTS_DESGLOSE = [4, 10, 21];

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

function buildIvaPctSelect(valorInicial) {
  const field = buildField("IVA %", "select");
  for (const pct of IVA_PCTS_DESGLOSE) {
    const opt = document.createElement("option");
    opt.value = String(pct);
    opt.textContent = `${pct}%`;
    field.input.appendChild(opt);
  }
  // valorInicial puede venir de BD como string numérico (numeric(5,2)) —
  // se normaliza antes de comparar contra las opciones del selector.
  const pctInicial = Number(valorInicial);
  field.input.value = String(IVA_PCTS_DESGLOSE.includes(pctInicial) ? pctInicial : IVA_PCTS_DESGLOSE[0]);
  return field;
}

// Redondea un IVA% detectado por el OCR al valor más cercano del selector.
function ivaPctCercano(valor) {
  return IVA_PCTS_DESGLOSE.reduce((a, b) => (Math.abs(b - valor) < Math.abs(a - valor) ? b : a));
}

function buildDesgloseToggle(checked) {
  const wrap = document.createElement("label");
  wrap.className = "ac-toggle";
  wrap.style.marginTop = "2px";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const span = document.createElement("span");
  span.textContent = "Desglosar IVA";
  wrap.append(input, span);
  return { wrap, input };
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

// Formulario de gasto — por defecto solo se ve "Importe total"; el
// checkbox "Desglosar IVA" (desactivado por defecto) revela el selector
// IVA% (4/10/21, sin 0%: ese caso es justo no desglosar) y, calculadas a
// partir del total, la base imponible y el IVA€ en solo lectura.
export function buildGastoFormFields(gastoInicial = null) {
  const comunes = buildCamposComunes(gastoInicial);
  const importeTotal = buildField("Importe total (€)", "input", {
    type: "number", min: "0", step: "0.01",
    value: gastoInicial?.importe ?? "0",
  });
  const ivaPct = buildIvaPctSelect(gastoInicial?.iva_pct);
  const toggle = buildDesgloseToggle(Boolean(Number(gastoInicial?.iva_pct)));
  const { fila: filaCalculada, baseImponible, ivaImporte } = buildFilaCalculada();

  const filaIva = document.createElement("div");
  filaIva.className = "ac-field-row hidden";
  filaIva.append(ivaPct.wrap);

  function refresh() {
    const activo = toggle.input.checked;
    filaIva.classList.toggle("hidden", !activo);
    filaCalculada.classList.toggle("hidden", !activo);
    if (!activo) return;
    const { baseImponible: base, ivaImporte: iva } = calcGastoDesdeImporte({
      importe: importeTotal.input.value,
      ivaPct: ivaPct.input.value,
    });
    baseImponible.input.value = (base ?? 0).toFixed(2);
    ivaImporte.input.value = (iva ?? 0).toFixed(2);
  }
  [importeTotal, ivaPct].forEach((f) => f.input.addEventListener("input", refresh));
  ivaPct.input.addEventListener("change", refresh);
  toggle.input.addEventListener("change", refresh);
  refresh();

  const fieldRow1 = document.createElement("div");
  fieldRow1.className = "ac-field-row";
  fieldRow1.append(comunes.fecha.wrap, comunes.proveedor.wrap);
  const fieldRow2 = document.createElement("div");
  fieldRow2.className = "ac-field-row";
  fieldRow2.append(comunes.cif.wrap, comunes.categoria.wrap);

  const wrap = document.createElement("div");
  wrap.append(
    fieldRow1,
    comunes.concepto.wrap,
    fieldRow2,
    importeTotal.wrap,
    toggle.wrap,
    filaIva,
    filaCalculada,
    comunes.notas.wrap
  );

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
      iva_pct:   toggle.input.checked ? Number(ivaPct.input.value) || 0 : 0,
    };
  }

  // El OCR extrae total_a_pagar (importe) e iva_pct de la factura. Con
  // IVA% > 0 se activa el desglose automáticamente (redondeando al valor
  // más cercano del selector); con 0% o sin dato, el desglose queda
  // desactivado y solo se rellena el importe.
  function rellenarDesdeOcr(datos) {
    if (datos.fecha)     comunes.fecha.input.value     = datos.fecha;
    if (datos.proveedor) comunes.proveedor.input.value = datos.proveedor;
    if (datos.cif)       comunes.cif.input.value       = datos.cif;
    if (datos.concepto)  comunes.concepto.input.value  = datos.concepto;
    if (datos.categoria && CATEGORIAS_GASTO.includes(datos.categoria)) comunes.categoria.input.value = datos.categoria;
    if (datos.total_a_pagar != null) importeTotal.input.value = datos.total_a_pagar;
    if (datos.iva_pct) {
      ivaPct.input.value = String(ivaPctCercano(datos.iva_pct));
      toggle.input.checked = true;
    } else {
      toggle.input.checked = false;
    }
    refresh();
  }

  return { wrap, validar, leerValores, rellenarDesdeOcr };
}
