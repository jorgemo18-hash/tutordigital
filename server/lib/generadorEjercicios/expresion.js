// UNA EXPRESIÓN DE ENTEROS, COMO ÁRBOL. Y su evaluación exacta.
//
// Es la pieza de la que cuelga todo el generador, y la decisión de fondo es
// esta: **una expresión no es una cadena de texto, es un árbol**.
//
// POR QUÉ NO TEXTO. Si el ejercicio se guarda como `"-3^2"` hay que
// escribir un analizador sintáctico para poder resolverlo, y ese analizador
// tiene que decidir si eso es `-(3²) = -9` o `(-3)² = 9`. Son dos ejercicios
// DISTINTOS y el tema 11 los pone a propósito uno al lado del otro para que
// el alumno vea la diferencia. Con texto, el generador y el corrector pueden
// interpretarlos distinto y nadie se enteraría: saldría una hoja con una
// solución que no corresponde al enunciado.
//
// Con árbol no hay ambigüedad posible: `neg(pot(3, 2))` y `pot(-3, 2)` son
// dos árboles diferentes. Se evalúan exacto y se imprimen con los paréntesis
// que hagan falta. El texto se DERIVA del árbol, nunca al revés.
//
// Y de paso resuelve lo que el plan llamaba "resolverlas para validarlas":
// no hay que pedirle a un modelo que compruebe su propia aritmética, porque
// la aritmética de enteros la hace este archivo, exacta y sin opinión.

// ── Construcción ──────────────────────────────────────────────────────────

export function num(n) {
  if (!Number.isInteger(n)) throw new Error(`num() solo acepta enteros, llegó ${n}`);
  return { tipo: "num", valor: n };
}

// Menos unario: `-(...)`. Es un nodo propio y NO "multiplicar por -1",
// porque lo que se imprime es distinto y en este tema eso es el contenido.
export function neg(hijo) {
  return { tipo: "neg", hijo: normaliza(hijo) };
}

// Se exporta porque la explicación de una combinada necesita saber qué
// aprieta más para decidir el orden de los pasos (ver explicacionJerarquia.js),
// y duplicar esa tabla allí sería tener dos jerarquías que pueden divergir.
export const OPERADORES = {
  "+": { precedencia: 1, asociativa: true },
  "-": { precedencia: 1, asociativa: false },
  "·": { precedencia: 2, asociativa: true },
  ":": { precedencia: 2, asociativa: false },
  "^": { precedencia: 3, asociativa: false },
};

export function op(simbolo, izq, der) {
  if (!OPERADORES[simbolo]) throw new Error(`operador desconocido: ${simbolo}`);
  return { tipo: "op", simbolo, izq: normaliza(izq), der: normaliza(der) };
}

// Azúcar para los casos frecuentes, que hace los generadores legibles.
export const suma = (a, b) => op("+", a, b);
export const resta = (a, b) => op("-", a, b);
export const por = (a, b) => op("·", a, b);
export const entre = (a, b) => op(":", a, b);
export const pot = (a, b) => op("^", a, b);

// Una cadena de sumas y restas: cadena([-6, "+", 7, "-", 4]).
// Se construye asociando a la IZQUIERDA, que es el orden en que se opera.
export function cadena(piezas) {
  if (!Array.isArray(piezas) || !piezas.length) throw new Error("cadena() necesita piezas");
  let arbol = normaliza(piezas[0]);
  for (let i = 1; i < piezas.length; i += 2) {
    arbol = op(piezas[i], arbol, piezas[i + 1]);
  }
  return arbol;
}

function normaliza(x) {
  if (typeof x === "number") return num(x);
  if (x && typeof x === "object" && x.tipo) return x;
  throw new Error(`no es una expresión: ${JSON.stringify(x)}`);
}

// ── Evaluación exacta ─────────────────────────────────────────────────────
//
// DEVUELVE UN RESULTADO, NO LANZA, cuando el problema es del ejercicio y no
// del código. Una división que no es exacta o un resultado gigante no son
// errores de programación: son el camino normal por el que el generador
// descarta un candidato y prueba otro. Eso pasa miles de veces y tiene que
// ser barato.
//
// Un árbol mal construido SÍ lanza (en `num`, `op`, `normaliza`): eso es un
// bug y tiene que verse.

// Sin calculadora en 1.º ESO (confirmado por Jorge el 17/09), así que los
// números que aparecen y el resultado tienen que caber en la cabeza. El tope
// no es para evitar desbordamientos: es pedagógico.
export const TOPE_ABSOLUTO = 10000;

// Un exponente no se calcula a mano nunca: o es pequeño, o la base es ±1 y
// se resuelve por paridad. Así que tiene su propio límite, holgado.
export const TOPE_EXPONENTE = 1000000;

export function evaluar(arbol, { tope = TOPE_ABSOLUTO } = {}) {
  try {
    const valor = calcula(normaliza(arbol), tope);
    return { valor, motivo: null };
  } catch (err) {
    if (err instanceof RechazoAritmetico) return { valor: null, motivo: err.motivo };
    throw err;
  }
}

class RechazoAritmetico extends Error {
  constructor(motivo) {
    super(motivo);
    this.motivo = motivo;
  }
}

function calcula(nodo, tope) {
  if (nodo.tipo === "num") return acota(nodo.valor, tope);
  if (nodo.tipo === "neg") return acota(-calcula(nodo.hijo, tope), tope);

  const a = calcula(nodo.izq, tope);
  // EL EXPONENTE NO PASA POR EL TOPE DE LOS OPERANDOS, y esto es un bug que
  // salió al probar `(-1)^2375` — un ejercicio real del catálogo, que se
  // pone justamente para ver si el alumno aplica la regla de paridad en vez
  // de intentar multiplicar. El tope existe porque en 1.º ESO no hay
  // calculadora y los números tienen que caber en la cabeza; un exponente
  // nunca se opera a mano, así que esa razón no le aplica. Con el tope
  // puesto, ese ejercicio se rechazaba por "fuera_de_rango".
  const b = nodo.simbolo === "^" ? calcula(nodo.der, TOPE_EXPONENTE) : calcula(nodo.der, tope);

  switch (nodo.simbolo) {
    case "+": return acota(a + b, tope);
    case "-": return acota(a - b, tope);
    case "·": return acota(a * b, tope);
    case ":":
      if (b === 0) throw new RechazoAritmetico("division_por_cero");
      // LA DIVISIÓN TIENE QUE SER EXACTA. Un cociente decimal convierte un
      // ejercicio de enteros en uno de decimales, que es otro tema y el
      // alumno no lo ha dado. Lo dicen los propios arquetipos del catálogo.
      if (a % b !== 0) throw new RechazoAritmetico("division_no_exacta");
      return acota(a / b, tope);
    case "^": {
      if (b < 0) throw new RechazoAritmetico("exponente_negativo");
      // Un exponente grande con base ±1 es un ejercicio legítimo y muy
      // usado ((-1)^2375 aparece en el catálogo): la regla de paridad se
      // aplica sin calcular nada. Con cualquier otra base, se desborda.
      if (Math.abs(a) === 1) return a === 1 ? 1 : (b % 2 === 0 ? 1 : -1);
      if (b > 12) throw new RechazoAritmetico("exponente_demasiado_grande");
      return acota(a ** b, tope);
    }
    default:
      throw new Error(`operador sin implementar: ${nodo.simbolo}`);
  }
}

function acota(valor, tope) {
  if (!Number.isFinite(valor)) throw new RechazoAritmetico("no_finito");
  if (!Number.isInteger(valor)) throw new RechazoAritmetico("no_entero");
  if (Math.abs(valor) > tope) throw new RechazoAritmetico("fuera_de_rango");
  return valor;
}

// ── Impresión ─────────────────────────────────────────────────────────────
//
// Los paréntesis se ponen por DOS motivos distintos y conviene no
// confundirlos:
//
//   1. OBLIGATORIOS: sin ellos la expresión impresa significaría otra cosa.
//      `(-3)^2` los necesita; `-3^2` es otra expresión.
//   2. DE ESTILO: un número negativo a la derecha de un operador se escribe
//      entre paréntesis porque `-6 + -1` no es notación de libro de texto.
//      Se escribe `-6 + (-1)`. Y los arquetipos piden mezclar las dos
//      escrituras a propósito (`-4 - 6` frente a `-6 + (-1)`), así que esto
//      es una opción, no una regla fija.

// DOS NOTACIONES, UN SOLO RECORRIDO.
//
// La hoja imprime las expresiones con KaTeX, dentro de `$...$`, y ahí el
// producto es `\cdot` y las llaves del exponente hacen falta en cuanto tiene
// dos cifras (`(-1)^{2375}`). En texto plano —logs, tests, un volcado por
// consola— se lee mucho mejor `-35 : (-5)` que su versión con barras
// invertidas.
//
// Son la MISMA expresión escrita de dos maneras, así que el recorrido del
// árbol es uno y lo único que cambia son estas cuatro cosas. Duplicar el
// recorrido sería duplicar la lógica de los paréntesis, que es justo la
// parte delicada.
export const TEXTO = {
  producto: " · ",
  division: " : ",
  suma: " + ",
  menos: " - ",
  exponente: (base, exp) => `${base}^${exp}`,
};

export const LATEX = {
  producto: " \\cdot ",
  division: " : ",
  // Sin espacios alrededor de + y −: KaTeX ya los separa, y el `-` de LaTeX
  // es un signo menos de verdad, no un guion.
  suma: "+",
  menos: "-",
  // Las llaves son obligatorias con más de una cifra: `x^24` en LaTeX es
  // `x²·4`, no `x²⁴`. Se ponen siempre, que no molesta.
  exponente: (base, exp) => `${base}^{${exp}}`,
};

// `parentesisSiempre` envuelve TODO número negativo, también el de la
// izquierda: `(-19) - (-21)`, `(-3) · 5`. Es la escritura que usan los
// arquetipos de resta y de producto del catálogo, porque en esas baterías lo
// que se practica es justamente ver el signo del número separado del de la
// operación. En las sumas, en cambio, el catálogo deja el de la izquierda
// desnudo (`-6 + (-1)`), así que no puede ser una regla fija.
export function render(arbol, opciones = {}) {
  const {
    negativosEntreParentesis = true,
    parentesisSiempre = false,
    notacion = TEXTO,
  } = opciones;
  return imprime(
    normaliza(arbol),
    0,
    "izq",
    { negativosEntreParentesis, parentesisSiempre, notacion },
    false,
  );
}

// La expresión lista para meter en un apartado de la hoja, ya entre `$...$`.
export function renderLatex(arbol, opciones = {}) {
  return render(arbol, { ...opciones, notacion: LATEX });
}

// PARÉNTESIS, CORCHETE, LLAVE — de dentro hacia fuera.
//
// Es la convención de los libros de texto españoles y el catálogo la usa
// explícitamente: `2 · [8 - 4 · (10 - 6) - (-3 - 2)]`, `-18 : [(-3) · (-2)]`.
// No es decoración: con tres niveles de paréntesis iguales, encontrar la
// pareja de cada uno es un ejercicio de paciencia visual que no tiene nada
// que ver con la jerarquía de operaciones.
//
// El nivel se decide MIRANDO LO QUE HAY DENTRO, no llevando la cuenta de la
// profundidad desde arriba: un grupo que ya contiene un corchete tiene que
// llevar llaves, y uno que contiene un paréntesis, corchetes. Hecho al revés
// —contando desde la raíz— el nivel dependería de la altura total del árbol y
// una expresión sin anidamiento acabaría entre llaves.
//
// Un negativo entre paréntesis cuenta como paréntesis, y eso es deliberado:
// `(-90) : [(-6) · (-3)]` es exactamente como lo escribe el catálogo.
function envuelve(texto) {
  if (texto.includes("[")) return `\\{${texto}\\}`;
  if (texto.includes("(")) return `[${texto}]`;
  return `(${texto})`;
}

// En texto plano las llaves van sin barras invertidas; en LaTeX hay que
// escaparlas porque `{` y `}` son suyos.
function envuelveTexto(texto) {
  if (texto.includes("[")) return `{${texto}}`;
  if (texto.includes("(")) return `[${texto}]`;
  return `(${texto})`;
}

function envolturaDe(opciones) {
  return opciones.notacion === LATEX ? envuelve : envuelveTexto;
}

// `trasOperador` dice si lo que se va a imprimir viene INMEDIATAMENTE
// DESPUÉS de un operador, sin nada en medio.
//
// NO ES LO MISMO QUE ESTAR "A LA DERECHA", y confundirlo fue un bug que salió
// en el folio: `-7 - -6 · 9`, con dos signos seguidos, que ningún libro
// escribe. El `-6` de esa expresión es el operando IZQUIERDO del producto, así
// que `lado` valía "izq" y la regla de "un negativo a la derecha se envuelve"
// no le aplicaba — pero en el papel el `-6` cae justo detrás del `-` de la
// resta, porque el producto no lleva paréntesis (aprieta más).
//
// La posición en el papel se hereda: el operando izquierdo de un nodo está
// tras un operador si el nodo entero lo está, y el derecho lo está siempre.
// Un paréntesis corta la herencia, porque ya separa los dos signos.
function imprime(nodo, precedenciaPadre, lado, opciones, trasOperador) {
  if (nodo.tipo === "num") {
    const texto = String(nodo.valor);
    // Un negativo justo detrás de un operador: `5 - (-3)`, `-7 - (-6) · 9`.
    const pegadoAUnOperador = trasOperador && opciones.negativosEntreParentesis;
    const necesita = nodo.valor < 0 && (pegadoAUnOperador || opciones.parentesisSiempre);
    // Y a la izquierda de una potencia SIEMPRE, obligatorio: `(-3)^2` no es
    // lo mismo que `-3^2`. Aquí no hay opción que valga.
    const obligatorio = nodo.valor < 0 && lado === "base";
    return necesita || obligatorio ? `(${texto})` : texto;
  }

  const envolver = envolturaDe(opciones);

  if (nodo.tipo === "neg") {
    // EL MENOS UNARIO APRIETA MENOS QUE LA POTENCIA, y eso no es un detalle:
    // es el contenido del tema 11. `-3^2` significa `-(3²) = -9`, y el
    // catálogo pone ese ejercicio justo al lado de `(-3)^2 = 9` para que el
    // alumno vea que no son lo mismo. Si aquí se imprimiera `-(3^2)`, el
    // ejercicio dejaría de tener sentido: se le estaría dando resuelta la
    // única dificultad que tiene.
    //
    // Con precedencia interna 3 sale solo: la potencia (3) no se envuelve,
    // el producto (2) y la suma (1) sí. `-(3 · 4)`, `-(-3 + 10)`, `-3^2`.
    const dentro = imprime(nodo.hijo, 3, "izq", opciones, false);
    // Dos menos seguidos no se imprimen nunca: `-(-3)`, no `--3`.
    const texto = dentro.startsWith("-") ? `-${envolver(dentro)}` : `-${dentro}`;
    // Y el `-(...)` entero se envuelve si está colgando de algo que aprieta
    // más, o a la derecha de cualquier operador (`5 - (-x)`).
    return precedenciaPadre >= 2 || lado === "der" || lado === "base" ? envolver(texto) : texto;
  }

  const { precedencia, asociativa } = OPERADORES[nodo.simbolo];

  // Hace falta paréntesis si el padre aprieta más; y con igual precedencia,
  // si estamos a la derecha de un operador no asociativo (`8 - (3 - 1)`).
  //
  // SE DECIDE ANTES DE IMPRIMIR LOS HIJOS, y no después como estaba, porque
  // los hijos necesitan saberlo: si este nodo va a llevar paréntesis, su
  // operando izquierdo ya NO queda pegado al operador de fuera.
  const aprieta = precedenciaPadre > precedencia;
  const derechaDeNoAsociativa = precedenciaPadre === precedencia && lado === "der";
  const dentroDeBase = lado === "base";
  const seEnvuelve = aprieta || derechaDeNoAsociativa || dentroDeBase;

  const izq = imprime(
    nodo.izq,
    precedencia,
    nodo.simbolo === "^" ? "base" : "izq",
    opciones,
    seEnvuelve ? false : trasOperador,
  );
  const der = imprime(nodo.der, precedencia, "der", opciones, true);
  const n = opciones.notacion;
  const union = { "+": n.suma, "-": n.menos, "·": n.producto, ":": n.division };
  const texto = nodo.simbolo === "^"
    ? n.exponente(izq, der)
    : `${izq}${union[nodo.simbolo]}${der}`;

  if (seEnvuelve) return envolver(texto);
  void asociativa;
  return texto;
}

// El enunciado tal como va en la hoja: la expresión y el hueco.
export function enunciado(arbol, opciones = {}) {
  return `${render(arbol, opciones)} = ___`;
}
