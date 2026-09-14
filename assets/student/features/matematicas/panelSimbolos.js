// LA BARRA DE SÍMBOLOS MATEMÁTICOS: una sola, para ordenador y para móvil.
//
// DÓNDE VA, Y POR QUÉ NO EN LA COLUMNA DE LA IZQUIERDA. Jorge la propuso en la
// columna izquierda, "igual que se usa la calculadora". Va ENCIMA DEL CUADRO DE
// ESCRIBIR, y la razón es que no es la misma clase de herramienta:
//
//  - La calculadora y la pizarra son tareas que se hacen aparte: entras, haces
//    la cuenta o el dibujo, y sales con un resultado. La columna izquierda es su
//    sitio.
//  - Los símbolos son una EXTENSIÓN DEL TECLADO. Escriben en el cuadro de la
//    derecha, así que tenerlos a la izquierda obliga a cruzar la pantalla con
//    el ratón y con la mirada por cada símbolo de la fórmula. Los teclados van
//    pegados al sitio donde se escribe.
//
// Y ADEMÁS ES LA RESPUESTA AL MÓVIL SIN HACER DOS COSAS: una barra encima del
// cuadro de texto es exactamente la forma que necesita un móvil (una fila
// encima del teclado). Un panel en la columna izquierda habría necesitado una
// segunda implementación para el móvil, donde esa columna se colapsa.
//
// Pista de que este era el diseño original: `ui/preview.js` —la vista previa de
// la fórmula, que ya estaba escrita— solo se enciende `if (padOpen)`, mirando
// un `#pad` con clase `show` que nunca llegó a existir en el HTML. Alguien
// planeó esta barra y se quedó a medias.
import { GRUPOS_SIMBOLOS, paraInsertar } from "./simbolos.js";

// Pinta la barra dentro de `contenedor`. `onSimbolo(plantilla)` recibe lo que
// hay que escribir; quién escribe y dónde no es asunto de este módulo.
export function pintarBarraSimbolos(contenedor, { onSimbolo, grupos = GRUPOS_SIMBOLOS } = {}) {
  if (!contenedor) return null;
  contenedor.innerHTML = "";

  // Se entrega ya traducido a lo que espera `insertAtCursor`: el texto y el
  // desplazamiento del cursor desde el final (ver paraInsertar en simbolos.js).
  const emitir = (plantilla) => {
    const { texto, desplazamiento } = paraInsertar(plantilla);
    onSimbolo?.(texto, desplazamiento);
  };

  for (const grupo of grupos) {
    const fila = document.createElement("div");
    fila.className = "sim-grupo";
    fila.setAttribute("role", "group");
    fila.setAttribute("aria-label", grupo.titulo);

    // El rótulo del grupo se esconde en móvil por CSS (no cabe), pero se queda
    // en el DOM: es lo que hace que un lector de pantalla no lea veintiocho
    // botones sueltos sin ninguna estructura.
    const rotulo = document.createElement("span");
    rotulo.className = "sim-grupo-rotulo";
    rotulo.textContent = grupo.titulo;
    fila.appendChild(rotulo);

    for (const simbolo of grupo.simbolos) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sim-btn";
      btn.textContent = simbolo.etiqueta;
      btn.title = simbolo.titulo;
      btn.setAttribute("aria-label", simbolo.titulo);
      btn.dataset.inserta = simbolo.inserta;

      // `mousedown` con preventDefault y NO `click`: al pulsar un botón el
      // navegador quita el foco del textarea antes del click, y con él se
      // pierde la posición del cursor — el símbolo acabaría siempre al final.
      // Así el cuadro no pierde el foco en ningún momento.
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        emitir(simbolo.inserta);
      });
      // El teclado y el táctil no pasan por `mousedown`: el táctil sí dispara
      // `click` después, pero ahí ya se ha ejecutado el `mousedown` sintético;
      // este `keydown` es para quien navega con tabulador.
      btn.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        emitir(simbolo.inserta);
      });

      fila.appendChild(btn);
    }
    contenedor.appendChild(fila);
  }

  return contenedor;
}

// Abrir y cerrar. El estado vive aquí y se consulta con `estaAbierta()`: la
// vista previa de la fórmula lo necesita para decidir si se enseña, y así no
// tiene que ir a buscar una clase en el DOM (que es como estaba y por lo que
// nunca se encendía).
export function crearBarraSimbolos({ contenedor, boton, entrada, onSimbolo, onCambioVisibilidad } = {}) {
  let abierta = false;

  function aplicar() {
    if (contenedor) contenedor.hidden = !abierta;
    if (boton) {
      boton.setAttribute("aria-pressed", abierta ? "true" : "false");
      boton.classList.toggle("sim-toggle--activo", abierta);
      boton.title = abierta ? "Ocultar símbolos" : "Símbolos matemáticos";
    }
    try { onCambioVisibilidad?.(abierta); } catch {}
  }

  function alternar(forzar = null) {
    abierta = forzar === null ? !abierta : Boolean(forzar);
    aplicar();
    // Al abrirla, el cuadro recupera el foco: se abre para escribir.
    if (abierta && entrada) { try { entrada.focus({ preventScroll: true }); } catch {} }
  }

  pintarBarraSimbolos(contenedor, { onSimbolo });
  aplicar();

  if (boton) boton.addEventListener("click", () => alternar());

  return { alternar, estaAbierta: () => abierta };
}
