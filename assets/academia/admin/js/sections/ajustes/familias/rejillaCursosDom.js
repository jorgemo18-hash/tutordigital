import { NIVELES, etiquetaNivel, etiquetaCortaNivel } from "../../../../../../shared/js/niveles.js";
import { nivelesDe, alternarNivel, normalizarReservas } from "../../../../../../shared/js/horarioReservas.js";
import { etiquetaBloque } from "../../../../../../shared/js/horarioBloques.js";

// La rejilla para reservar horas a un curso: se elige un curso arriba y se
// pinchan las horas, como quien marca el horario de un alumno.
//
// POR QUÉ NO SON DESPLEGABLES. La primera versión ponía un <select> en cada
// casilla: veinticinco cajas grises para marcar tres o cuatro horas, y para
// leer el horario de un vistazo había que leerse las veinticinco. Además un
// desplegable solo deja elegir UN curso por hora, y eso se rompe en cuanto
// hay dos profesores — a las cuatro puede haber Primaria con una y ESO con
// otro. Pintando, una casilla admite los cursos que hagan falta y el
// horario se lee como un horario.
//
// Una casilla en blanco es una hora abierta a cualquier curso. No se
// escribe "Todos" en pantalla: en la rejilla del editor el blanco se
// entiende, y llenarla de "Todos" repetidos sería el mismo ruido que se
// quitó con los desplegables. En el papel impreso sí se escribe, porque
// allí un hueco vacío se lee como "no hay clase".

function buildPincel(nivelActivo, onElegir) {
  const barra = document.createElement("div");
  barra.className = "ac-pincel";

  for (const nivel of NIVELES) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `ac-pincel-chip ${nivel.id} ${nivel.id === nivelActivo ? "on" : ""}`;
    chip.textContent = nivel.label;
    chip.setAttribute("aria-pressed", String(nivel.id === nivelActivo));
    chip.addEventListener("click", () => onElegir(nivel.id));
    barra.appendChild(chip);
  }
  return barra;
}

// El texto de una casilla: el nombre entero cuando hay un curso, y las
// abreviaturas cuando hay varios — que es justo lo que se imprime en la
// hoja, para que lo que se ve aquí sea lo que sale por la impresora.
export function textoDeCasilla(niveles) {
  if (!niveles.length) return "";
  if (niveles.length === 1) return etiquetaNivel(niveles[0]);
  return niveles.map(etiquetaCortaNivel).join(" · ");
}

function buildCasilla(niveles, { titulo, onClick }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-hora-celda ${niveles.length ? "marcada" : ""} ${niveles.length === 1 ? niveles[0] : ""}`;
  btn.title = titulo;
  btn.textContent = textoDeCasilla(niveles);
  btn.addEventListener("click", onClick);
  return btn;
}

export function buildRejillaCursos({ bloques, dias, reservas: reservasIniciales, onCambio = () => {} } = {}) {
  let reservas = normalizarReservas(reservasIniciales);
  let pincel = NIVELES[0].id;

  const el = document.createElement("div");
  el.className = "ac-horas-wrap";

  function pintarCasilla(dia, bloque) {
    reservas = alternarNivel(reservas, dia.num, bloque, pincel);
    onCambio();
    render();
  }

  function buildTabla() {
    const tabla = document.createElement("table");
    tabla.className = "ac-horas";

    const thead = document.createElement("thead");
    const cabecera = document.createElement("tr");
    cabecera.appendChild(document.createElement("th"));
    for (const dia of dias) {
      const th = document.createElement("th");
      th.className = "ac-hora-dia";
      th.textContent = dia.label;
      cabecera.appendChild(th);
    }
    thead.appendChild(cabecera);

    const tbody = document.createElement("tbody");
    for (const bloque of bloques) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.className = "ac-hora-etiqueta";
      th.textContent = etiquetaBloque(bloque);
      tr.appendChild(th);

      for (const dia of dias) {
        const td = document.createElement("td");
        const niveles = nivelesDe(reservas, dia.num, bloque);
        td.appendChild(buildCasilla(niveles, {
          titulo: `${dia.label} ${etiquetaBloque(bloque)}`,
          onClick: () => pintarCasilla(dia, bloque),
        }));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    tabla.append(thead, tbody);
    return tabla;
  }

  function render() {
    el.innerHTML = "";
    el.append(
      buildPincel(pincel, (nivel) => { pincel = nivel; render(); }),
      buildTabla()
    );
  }

  render();

  return { el, getValue: () => normalizarReservas(reservas) };
}
