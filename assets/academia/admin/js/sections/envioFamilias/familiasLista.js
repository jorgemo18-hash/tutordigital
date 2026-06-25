function dotClase(recibo) {
  if (!recibo) return "ef-dot--sin-recibo";
  return recibo.estado === "enviado" ? "ef-dot--enviado" : "ef-dot--borrador";
}

function buildFila(item, { selected, onSelect }) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `ef-fila${selected ? " ef-fila--activa" : ""}`;

  const dot = document.createElement("span");
  dot.className = `ef-dot ${dotClase(item.recibo)}`;
  row.appendChild(dot);

  const nombre = document.createElement("span");
  nombre.className = "ef-fila-nombre";
  nombre.textContent = item.familia_nombre;
  row.appendChild(nombre);

  if (item.recibo) {
    const total = document.createElement("span");
    total.className = "ef-fila-total";
    total.textContent = `${Number(item.recibo.total_neto).toFixed(2)} €`;
    row.appendChild(total);
  }

  row.addEventListener("click", () => onSelect(item));
  return row;
}

// Panel izquierdo: una fila por familia activa con un punto de estado
// (naranja=borrador, verde=enviado, gris=sin recibo este mes) + su total
// neto si ya tiene recibo generado.
export function buildFamiliasLista(items, { selectedId, onSelect }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-lista";

  if (!items.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "No hay familias activas.";
    wrap.appendChild(p);
    return wrap;
  }

  for (const item of items) {
    wrap.appendChild(buildFila(item, { selected: item.familia_id === selectedId, onSelect }));
  }
  return wrap;
}
