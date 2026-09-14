// EL CATÁLOGO DE SÍMBOLOS MATEMÁTICOS, Y DÓNDE QUEDA EL CURSOR.
//
// PARA QUÉ (Jorge, 14/09/2026): *"nació con el sentido de que si querías
// escribir un ejercicio, pudieras poner 'x al cuadrado' bien y no x^2, que
// mucha gente ni lo sabe"*.
//
// LA IDEA, QUE ES LA DE UNA CALCULADORA: se pulsa un botón, se escribe en el
// cuadro de texto, y encima del cuadro la vista previa enseña la fórmula ya
// dibujada. El cuadro sigue teniendo texto normal (`x^2`), y lo bonito se ve
// en la vista previa. Un cuadro donde la fórmula se dibuja DENTRO mientras
// escribes es otra cosa —otra librería, y mala en móvil— y no es esto.
//
// LO QUE SE INSERTA TIENE QUE ENTENDERLO `asciiToLatex` (controllers/math.js),
// que es quien traduce lo del alumno antes de dibujarlo. Por eso los símbolos
// son los que ese traductor ya conoce (×, ÷, π, ≤, ≥, ≠, ≈, √(), a/b) más los
// que KaTeX dibuja directamente en Unicode. **Cada entrada de este catálogo
// está comprobada dibujándola de verdad en Chromium** — ver el test
// `panelDeSimbolos.test.mjs` y el guion de verificación que describe.
//
// EL CURSOR SE MARCA CON `‸` en la plantilla: `√(‸)` deja el cursor dentro del
// paréntesis, listo para escribir el radicando. Sin eso, cada símbolo obliga a
// mover el cursor a mano y la herramienta estorba más de lo que ayuda.
//
// ES `‸` (U+2038) Y NO `|` POR UN FALLO YA COMETIDO: la primera versión usaba
// la barra vertical, que **choca con las barras del valor absoluto** — la
// plantilla `\left|| \right|` se quedaba en `\left \right` al limpiar las
// marcas, y KaTeX la rechazaba. Se vio dibujando los 28 símbolos del catálogo
// en Chromium, no leyéndolos. El `‸` significa literalmente "aquí va lo que
// falta" y no puede aparecer en una fórmula escrita por un alumno.

export const MARCA_CURSOR = "\u2038";

// `etiqueta` es lo que se ve en el botón; `inserta`, lo que se escribe;
// `titulo`, lo que se lee al pasar por encima y lo que oye un lector de
// pantalla — un botón que solo dice "√" no se entiende sin verlo.
export const GRUPOS_SIMBOLOS = [
  {
    id: "potencias",
    titulo: "Potencias y raíces",
    simbolos: [
      { etiqueta: "x²", inserta: "^2", titulo: "Elevado al cuadrado" },
      { etiqueta: "x³", inserta: "^3", titulo: "Elevado al cubo" },
      { etiqueta: "xⁿ", inserta: "^\u2038", titulo: "Elevado a…" },
      { etiqueta: "√", inserta: "√(\u2038)", titulo: "Raíz cuadrada" },
      { etiqueta: "x₁", inserta: "_\u2038", titulo: "Subíndice" },
    ],
  },
  {
    id: "fracciones",
    titulo: "Fracciones y paréntesis",
    simbolos: [
      { etiqueta: "a/b", inserta: " \u2038 / ", titulo: "Fracción" },
      { etiqueta: "( )", inserta: "(\u2038)", titulo: "Paréntesis" },
      { etiqueta: "|x|", inserta: "\\left|\u2038 \\right|", titulo: "Valor absoluto" },
    ],
  },
  {
    id: "operadores",
    titulo: "Operaciones",
    simbolos: [
      { etiqueta: "×", inserta: "×", titulo: "Multiplicado por" },
      { etiqueta: "÷", inserta: "÷", titulo: "Dividido entre" },
      { etiqueta: "±", inserta: "\\pm ", titulo: "Más menos" },
      { etiqueta: "≤", inserta: "≤", titulo: "Menor o igual" },
      { etiqueta: "≥", inserta: "≥", titulo: "Mayor o igual" },
      { etiqueta: "≠", inserta: "≠", titulo: "Distinto de" },
      { etiqueta: "≈", inserta: "≈", titulo: "Aproximadamente" },
    ],
  },
  {
    id: "funciones",
    titulo: "Funciones",
    simbolos: [
      { etiqueta: "sen", inserta: "\\sin(\u2038)", titulo: "Seno" },
      { etiqueta: "cos", inserta: "\\cos(\u2038)", titulo: "Coseno" },
      { etiqueta: "tg", inserta: "\\tan(\u2038)", titulo: "Tangente" },
      { etiqueta: "log", inserta: "\\log(\u2038)", titulo: "Logaritmo" },
      { etiqueta: "ln", inserta: "\\ln(\u2038)", titulo: "Logaritmo neperiano" },
    ],
  },
  {
    id: "otros",
    titulo: "Otros",
    simbolos: [
      { etiqueta: "π", inserta: "π", titulo: "Pi" },
      { etiqueta: "α", inserta: "\\alpha ", titulo: "Alfa" },
      { etiqueta: "β", inserta: "\\beta ", titulo: "Beta" },
      { etiqueta: "θ", inserta: "\\theta ", titulo: "Theta" },
      { etiqueta: "°", inserta: "^\\circ ", titulo: "Grados" },
      { etiqueta: "∞", inserta: "\\infty ", titulo: "Infinito" },
      { etiqueta: "∑", inserta: "\\sum_{\u2038}", titulo: "Sumatorio" },
      { etiqueta: "∫", inserta: "\\int_{\u2038}", titulo: "Integral" },
    ],
  },
];

// Todos los símbolos en una lista, para barrer el catálogo en los tests y para
// la fila de móvil, que no va por grupos.
export function todosLosSimbolos() {
  return GRUPOS_SIMBOLOS.flatMap((g) => g.simbolos.map((s) => ({ ...s, grupo: g.id })));
}

// La plantilla sin la marca del cursor: lo que de verdad se escribe.
export function textoDe(plantilla = "") {
  return String(plantilla).split(MARCA_CURSOR).join("");
}

// LO QUE NECESITA `insertAtCursor` (ui/input.js) PARA ESCRIBIRLO.
//
// No se escribe aquí en el cuadro de texto: eso ya lo hace `insertAtCursor`,
// que además devuelve el foco, dispara el evento `input` y refresca la vista
// previa. La primera versión de este módulo traía su propia función de
// inserción — una copia de algo que ya existía y estaba mejor resuelto.
//
// La traducción es de formato: aquí el cursor se marca DENTRO de la plantilla
// (`√(‸)`), y esa función lo recibe como un desplazamiento desde el final de lo
// insertado (negativo para volver hacia atrás).
export function paraInsertar(plantilla = "") {
  const trozos = String(plantilla).split(MARCA_CURSOR);
  const texto = trozos.join("");
  const despues = trozos.length > 1 ? trozos.slice(1).join("") : "";
  // `despues.length ? ... : 0` y no `-despues.length` a secas: con la cadena
  // vacía eso da `-0`, que no es igual a `0` para `Object.is` ni para un
  // `deepEqual`. Nadie quiere depurar un -0 dentro de un cálculo de cursor.
  return { texto, desplazamiento: despues.length ? -despues.length : 0 };
}
