import { buildIcon } from "../../icons.js";
import { calcularEstadoFamilia, claseDotEstado } from "./estadoFamilia.js";

function cursosDeFamilia(item) {
  return [...new Set(item.alumnos_activos.map((a) => a.curso).filter(Boolean))].join(", ");
}

function buildFila(item, { selected, onSelect, tieneError }) {
  const estado = calcularEstadoFamilia(item, { tieneError });
  const sinEmail = estado.tipo === "sin_email";

  const row = document.createElement("button");
  row.type = "button";
  row.className = `ef-fila${selected ? " ef-fila--activa" : ""}${sinEmail ? " ef-fila--sin-email" : ""}`;

  const dot = document.createElement("span");
  dot.className = `ef-dot ${claseDotEstado(estado.tipo)}`;
  row.appendChild(dot);

  const info = document.createElement("span");
  info.className = "ef-fila-info";
  const nombre = document.createElement("span");
  nombre.className = "ef-fila-nombre";
  nombre.textContent = item.familia_nombre;
  const sub = document.createElement("span");
  sub.className = "ef-fila-sub";
  const cursos = cursosDeFamilia(item);
  sub.textContent = cursos ? `${cursos} · ${estado.texto}` : estado.texto;
  info.append(nombre, sub);
  row.appendChild(info);

  if (sinEmail) row.appendChild(buildIcon("alertTriangle", { size: 14 }));

  row.addEventListener("click", () => onSelect(item));
  return row;
}

// Panel izquierdo: una fila por familia activa con un punto de estado
// (naranja=pendiente, verde=enviado, rojo=error de esta sesión, gris=sin
// recibo/informe este mes o sin email) — ver estadoFamilia.js para el
// cálculo. `familiasConError` es un Set de familia_id, transitorio de esta
// sesión del navegador (ver envioFamiliasSection.js).
export function buildFamiliasLista(items, { selectedId, onSelect, familiasConError = new Set() }) {
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
    wrap.appendChild(
      buildFila(item, { selected: item.familia_id === selectedId, onSelect, tieneError: familiasConError.has(item.familia_id) })
    );
  }
  return wrap;
}
