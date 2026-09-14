// EL EJEMPLO RESUELTO, con su pestaña "EJEMPLO".
//
// Es la pieza de las fichas de refuerzo de Santillana que hace que la hoja
// sirva sin el profesor delante: enunciado + los pasos, uno por línea, con el
// paso visible y no solo el resultado.
//
// UNO O DOS COMO MÁXIMO. Con tres, la hoja es un libro de texto. Y el ejemplo
// tiene que ser del MISMO tipo que alguno de los ejercicios de abajo: si
// resuelve algo que no se pregunta, el alumno se queda igual.

const MAX_EJEMPLOS = 2;

function buildUno({ enunciado = "", pasos = [] }, doc) {
  const wrap = doc.createElement("section");
  wrap.className = "hj-ejemplo";

  const tab = doc.createElement("div");
  tab.className = "hj-ejemplo-tab";
  tab.textContent = "Ejemplo";

  const caja = doc.createElement("div");
  caja.className = "hj-ejemplo-caja";

  if (enunciado) {
    const e = doc.createElement("p");
    e.className = "hj-ejemplo-enunciado";
    e.textContent = enunciado;
    caja.appendChild(e);
  }

  pasos.forEach((texto) => {
    const p = doc.createElement("p");
    p.className = "hj-ejemplo-paso";
    // La flecha va en su propio span para poder teñirla de cobre sin tocar el
    // texto del paso (que tiene que seguir siendo negro en la fotocopia).
    const flecha = doc.createElement("span");
    flecha.className = "hj-flecha";
    flecha.textContent = "→";
    p.append(flecha, doc.createTextNode(texto));
    caja.appendChild(p);
  });

  wrap.append(tab, caja);
  return wrap;
}

export function buildEjemplos(ejemplos = [], doc = globalThis.document) {
  return ejemplos.slice(0, MAX_EJEMPLOS).map((ej) => buildUno(ej, doc));
}
