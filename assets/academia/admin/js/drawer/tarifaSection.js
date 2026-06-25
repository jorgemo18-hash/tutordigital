function buildField(label, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement("input");
  input.className = "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}

function calcPrecioNeto(bruto, descuentoPct) {
  const b = Number(bruto) || 0;
  const d = Number(descuentoPct) || 0;
  return Math.round(b * (1 - d / 100) * 100) / 100;
}

// `tarifaActual`: {precio_bruto, descuento_pct} vigente del alumno, o null.
// `onChange` se llama tras cada recálculo (lo usa la sección Familia para
// mostrar en tiempo real la tarifa del alumno nuevo dentro del bloque
// "Familia completa", sin duplicar estos campos en dos sitios).
export function buildTarifaSection({ tarifaActual = null, onChange } = {}) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "TARIFA MENSUAL";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const row = document.createElement("div");
  row.className = "ac-field-row";
  const bruto = buildField("Precio bruto (€)", { type: "number", min: "0", step: "0.01", value: tarifaActual?.precio_bruto ?? "" });
  const descuento = buildField("Descuento (%)", { type: "number", min: "0", max: "100", step: "1", value: tarifaActual?.descuento_pct ?? 0 });
  row.append(bruto.wrap, descuento.wrap);
  wrap.appendChild(row);

  const neto = buildField("Precio neto (€)", { type: "number", readOnly: true, disabled: true });
  neto.input.classList.add("ac-tarifa-readonly");
  wrap.appendChild(neto.wrap);

  function refreshNeto() {
    neto.input.value = calcPrecioNeto(bruto.input.value, descuento.input.value).toFixed(2);
    onChange?.();
  }
  bruto.input.addEventListener("input", refreshNeto);
  descuento.input.addEventListener("input", refreshNeto);
  refreshNeto();

  return {
    wrap,
    // null si no se ha introducido ningún precio — el drawer no envía
    // tarifa en ese caso (no se crea/cierra ninguna fila en el backend).
    getValue: () => {
      const precioBruto = Number(bruto.input.value);
      if (!bruto.input.value || Number.isNaN(precioBruto) || precioBruto <= 0) return null;
      return { precio_bruto: precioBruto, descuento_pct: Number(descuento.input.value) || 0 };
    },
  };
}
