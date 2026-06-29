// Fila "[casilla] descripción ... importe" — compartida por los 4
// modelos fiscales. buildCasillaEditable es un campo puramente editable
// (minoración, base alquiler...), sin concepto de "sobrescritura" porque
// no hay nada calculado que sobrescribir. buildCasillaCalculada es una
// casilla que normalmente se recalcula sola (setComputed) pero el admin
// puede escribir encima — en cuanto el valor escrito difiere del último
// calculado, queda "congelada" en ese valor y se marca con un punto cobre.
function buildCasillaBase(numero, label, calculada) {
  const row = document.createElement("div");
  row.className = calculada ? "ac-fiscal-casilla-row ac-fiscal-casilla-row--calculada" : "ac-fiscal-casilla-row";

  const numeroEl = document.createElement("span");
  numeroEl.className = "ac-fiscal-casilla-numero";
  numeroEl.textContent = numero ? `[${numero}]` : "";

  const labelEl = document.createElement("span");
  labelEl.className = "ac-fiscal-casilla-label";
  labelEl.textContent = label;

  const valorWrap = document.createElement("span");
  valorWrap.className = "ac-fiscal-casilla-valor-wrap";

  row.append(numeroEl, labelEl, valorWrap);
  return { row, valorWrap };
}

function buildUnidad(texto) {
  const el = document.createElement("span");
  el.className = "ac-fiscal-casilla-unidad";
  el.textContent = texto;
  return el;
}

export function buildCasillaEditable(numero, label, { unidad = "€", valorInicial = 0, attrs = {} } = {}) {
  const { row, valorWrap } = buildCasillaBase(numero, label, false);
  const input = document.createElement("input");
  input.type = "number";
  input.className = "ac-fiscal-casilla-input";
  input.value = valorInicial;
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  valorWrap.appendChild(input);
  if (unidad) valorWrap.appendChild(buildUnidad(unidad));
  return { row, input };
}

export function buildCasillaCalculada(numero, label, { unidad = "€", valorInicialOverride = null } = {}) {
  const { row, valorWrap } = buildCasillaBase(numero, label, true);

  const dot = document.createElement("span");
  dot.className = "ac-fiscal-override-dot";
  dot.title = "Valor modificado manualmente";

  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  input.className = "ac-fiscal-casilla-input";

  let overridden = valorInicialOverride != null;
  let ultimoComputado = 0;
  if (overridden) input.value = valorInicialOverride;
  dot.hidden = !overridden;

  input.addEventListener("input", () => {
    const actual = Number(input.value) || 0;
    if (Math.abs(actual - ultimoComputado) > 0.001) {
      overridden = true;
      dot.hidden = false;
    }
  });

  valorWrap.append(dot, input);
  if (unidad) valorWrap.appendChild(buildUnidad(unidad));

  return {
    row,
    input,
    isOverridden: () => overridden,
    getValue: () => Number(input.value) || 0,
    setComputed(valor) {
      ultimoComputado = valor;
      if (!overridden) input.value = valor.toFixed(2);
    },
  };
}

export function formatEuros(valor) {
  return `${Number(valor || 0).toFixed(2)} €`;
}
