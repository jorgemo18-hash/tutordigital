// Fila de lectura "[casilla] Etiqueta ............ valor" — compartida
// por Modelo 130/115/111 para las casillas que no son editables (las
// editables usan buildField de campoField.js).
export function buildCasillaRow(numero, label) {
  const row = document.createElement("div");
  row.className = "ac-fiscal-casilla-row";
  const lbl = document.createElement("span");
  lbl.className = "ac-fiscal-casilla-label";
  lbl.textContent = numero ? `[${numero}] ${label}` : label;
  const val = document.createElement("span");
  val.className = "ac-fiscal-casilla-valor";
  row.append(lbl, val);
  return { row, val };
}

export function formatEuros(valor) {
  return `${Number(valor || 0).toFixed(2)} €`;
}
