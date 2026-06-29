// Fila "[casilla] descripción ... importe" estilo formulario AEAT —
// compartida por Modelo 130/115/111. buildCasillaFiscal es de solo
// lectura (importe en un <span>); buildCasillaEditable pone un <input>
// numérico en su lugar, con borde inferior activo al enfocar (CSS) y sin
// rastro visual hasta que se usa, para que parezca "editable inline".
function buildCasillaBase(numero, label, calculada) {
  const row = document.createElement("div");
  row.className = calculada
    ? "ac-fiscal-casilla-row ac-fiscal-casilla-row--calculada ac-paper-line"
    : "ac-fiscal-casilla-row ac-paper-line";

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

export function buildCasillaFiscal(numero, label, { calculada = false } = {}) {
  const { row, valorWrap } = buildCasillaBase(numero, label, calculada);
  const val = document.createElement("span");
  val.className = "ac-fiscal-casilla-valor";
  valorWrap.appendChild(val);
  return { row, val };
}

export function buildCasillaEditable(numero, label, { unidad = "€", valorInicial = 0, attrs = {} } = {}) {
  const { row, valorWrap } = buildCasillaBase(numero, label, false);
  const input = document.createElement("input");
  input.type = "number";
  input.className = "ac-fiscal-casilla-input";
  input.value = valorInicial;
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  valorWrap.appendChild(input);

  if (unidad) {
    const unidadEl = document.createElement("span");
    unidadEl.className = "ac-fiscal-casilla-unidad";
    unidadEl.textContent = unidad;
    valorWrap.appendChild(unidadEl);
  }
  return { row, input };
}

export function formatEuros(valor) {
  return `${Number(valor || 0).toFixed(2)} €`;
}
