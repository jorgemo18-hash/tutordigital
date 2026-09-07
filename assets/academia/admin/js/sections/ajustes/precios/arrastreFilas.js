// Arrastrar las filas de la tabla de precios para cambiarlas de orden.
//
// POR QUÉ EXISTE. El "+" añade siempre al final. Quien monta la tabla y se
// da cuenta tarde de que le falta un tramo —"4 h / semana" entre el de 3 y
// el de 5— no tenía forma de colocarlo, y la hoja impresa salía con los
// tramos desordenados. Renombrar cuatro filas para colar una es un lío que
// acaba en precios cambiados de sitio.
//
// EL ASA, Y NO LA FILA ENTERA. Se arrastra desde las tres rayas de la
// izquierda, no desde cualquier parte de la fila: dentro de la fila hay
// inputs de texto, y arrastrar para seleccionar un precio escrito no puede
// acabar moviendo la fila de sitio. `tr.draggable` solo se enciende mientras
// el asa está pulsada, que es el truco clásico para eso.
//
// Y CON EL TECLADO TAMBIÉN. El asa es un <button>: con el foco puesto,
// flecha arriba y flecha abajo mueven la fila. No es solo accesibilidad —
// para mover una fila un puesto exacto es más cómodo que arrastrar, y en un
// portátil con trackpad, bastante más.

const CLASE_ARRASTRANDO = "ac-arrastrando";
const CLASE_DESTINO = "ac-destino";

function buildAsa(etiqueta) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-precio-asa";
  btn.title = `${etiqueta} — arrastra, o usa las flechas arriba y abajo`;
  btn.setAttribute("aria-label", btn.title);
  // Las tres rayas se pintan en CSS (::before), no con texto: el carácter
  // "⠿" no está en todas las fuentes del sistema y en algunas sale como un
  // cuadrado vacío.
  return btn;
}

// `onMover(desde, hasta)` recibe ÍNDICES de fila, no ids: quien llama ya
// tiene el modelo delante y sabe traducirlos. Aquí no se toca el modelo.
export function crearArrastreDeFilas({ onMover = () => {} } = {}) {
  let origen = null;

  function soltarMarcas(tr) {
    tr.classList.remove(CLASE_ARRASTRANDO, CLASE_DESTINO);
  }

  // Convierte una fila en destino válido de un arrastre. Sin el
  // preventDefault del dragover el navegador NO dispara drop: es el fallo
  // silencioso de todo drag-and-drop hecho a mano.
  function prepararDestino(tr, indice) {
    tr.addEventListener("dragover", (evento) => {
      if (origen === null || origen === indice) return;
      evento.preventDefault();
      tr.classList.add(CLASE_DESTINO);
    });
    tr.addEventListener("dragleave", () => tr.classList.remove(CLASE_DESTINO));
    tr.addEventListener("drop", (evento) => {
      evento.preventDefault();
      tr.classList.remove(CLASE_DESTINO);
      const desde = origen;
      origen = null;
      if (desde !== null && desde !== indice) onMover(desde, indice);
    });
  }

  function prepararOrigen(tr, indice, asa) {
    asa.addEventListener("pointerdown", () => { tr.draggable = true; });
    asa.addEventListener("pointerup", () => { tr.draggable = false; });

    tr.addEventListener("dragstart", (evento) => {
      origen = indice;
      tr.classList.add(CLASE_ARRASTRANDO);
      if (!evento.dataTransfer) return;
      evento.dataTransfer.effectAllowed = "move";
      // Firefox no empieza el arrastre si no hay datos puestos, aunque no
      // los use nadie.
      evento.dataTransfer.setData("text/plain", String(indice));
    });

    tr.addEventListener("dragend", () => {
      tr.draggable = false;
      origen = null;
      soltarMarcas(tr);
    });

    asa.addEventListener("keydown", (evento) => {
      if (evento.key !== "ArrowUp" && evento.key !== "ArrowDown") return;
      evento.preventDefault();
      onMover(indice, indice + (evento.key === "ArrowUp" ? -1 : 1));
    });
  }

  // Devuelve el asa ya cableada, lista para meterla en el encabezado de la
  // fila.
  return function conectarFila(tr, indice, etiqueta) {
    const asa = buildAsa(etiqueta);
    prepararOrigen(tr, indice, asa);
    prepararDestino(tr, indice);
    return asa;
  };
}
