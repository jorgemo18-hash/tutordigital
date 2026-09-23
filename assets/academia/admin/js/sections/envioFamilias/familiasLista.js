import { buildIcon } from "../../icons.js";
import { calcularEstadoFamilia, claseDotEstado } from "./estadoFamilia.js";

// LOS NOMBRES DE LOS ALUMNOS, NO LOS CURSOS. Jorge, 23/09: *"aparece el
// nombre de la familia para mandar los informes y recibos, pero yo conozco el
// nombre de los alumnos, no de las familias"*.
//
// La familia SIGUE ARRIBA porque es a quien se le manda el recibo y de quien
// es el email: quitarla dejaría la fila sin decir a dónde va el dinero. Lo
// que se cae de la línea pequeña son los cursos, que estaban ahí para
// distinguir familias con el mismo apellido y para eso el nombre del alumno
// sirve mejor. Los cursos siguen estando en el panel de la derecha.
function alumnosDeFamilia(item) {
  return item.alumnos_activos.map((a) => a.nombre).filter(Boolean).join(", ");
}

function buildFila(item, { selected, onSelect, tieneError }) {
  const estado = calcularEstadoFamilia(item, { tieneError });
  const sinEmail = estado.tipo === "sin_email";
  const noLlego = estado.tipo === "no_llego";

  const row = document.createElement("button");
  row.type = "button";
  row.className = `ef-fila${selected ? " ef-fila--activa" : ""}${sinEmail ? " ef-fila--sin-email" : ""}`;
  // EL MOTIVO COMPLETO EN EL title. En la fila cabe recortado, y lo que
  // Jorge necesita para arreglarlo es el texto entero del proveedor
  // ("Recipient address does not exist"): dice qué hacer, y "no llegó" no.
  if (noLlego && estado.motivo) row.title = estado.motivo;

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
  const alumnos = alumnosDeFamilia(item);
  sub.textContent = alumnos ? `${alumnos} · ${estado.texto}` : estado.texto;
  // La columna mide 280px y una familia de tres hermanos no cabe. El title va
  // en el `span` y no en la fila porque la fila ya usa el suyo para el motivo
  // del rebote, que es más importante.
  if (alumnos) sub.title = `${alumnos} · ${estado.texto}`;
  info.append(nombre, sub);
  row.appendChild(info);

  // El mismo triángulo que "sin email": las dos cosas son "a esta familia
  // no le va a llegar nada", y conviene que se busquen con el mismo gesto.
  if (sinEmail || noLlego) row.appendChild(buildIcon("alertTriangle", { size: 14 }));

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
    // "con alumnos activos" y no "activas": desde el 12/09 la lista solo
    // trae las accionables (ver familiasSinActivos.js), así que puede quedar
    // vacía habiendo familias — y el pie de debajo dice cuántas y quiénes.
    p.textContent = "Ninguna familia con alumnos activos este mes.";
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
