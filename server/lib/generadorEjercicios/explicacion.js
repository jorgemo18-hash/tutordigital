// LA EXPLICACIÓN DE UN APARTADO RESUELTO, en una línea o dos.
//
// Jorge, el 17/9: *"habría que hacer un ejemplo (siempre) de cada ejercicio,
// porque un ejemplo global no sirve para algún ejercicio... si el ejercicio
// tiene cinco apartados, uno resuelto y los otros para que los haga"*.
//
// AQUÍ NO HACE FALTA UN MODELO, Y ESO NO ES OBVIO. El razonamiento de un
// ejercicio mecánico es él mismo mecánico: para `(-3) · 5` la explicación es
// siempre "los signos son distintos, así que negativo; 3 · 5 = 15". No hay
// nada que redactar, hay una plantilla por forma de expresión. Y como sale del
// ÁRBOL y no del texto, dice exactamente lo que el apartado hace — no lo que
// un modelo supone que hace.
//
// Donde sí hará falta un modelo es en los problemas con enunciado, que no
// tienen forma: ahí el razonamiento habla de termómetros y de deudas.
//
// LA EXPLICACIÓN DICE EL NÚMERO, no solo la regla. "La base es negativa y el
// exponente impar, así que negativo" deja al alumno a medio camino; hay que
// cerrar con `2³ = 8`. La primera versión de este archivo se quedaba en la
// regla y en el folio se veía que faltaba el final.

const ABS = Math.abs;

function nombreDeSigno(n) {
  return n < 0 ? "negativo" : "positivo";
}

// EL MENOS DE UN NÚMERO ES UN MENOS, NO UN GUION.
//
// La explicación es texto plano —no pasa por KaTeX, que es lo que compone las
// fórmulas—, así que el carácter que se escriba es el que se imprime. Con
// `String(-7)` sale un guion ASCII, y en el folio se veía la mezcla: los
// operadores con menos tipográfico (−) y los números con guion (-) en la
// misma línea, `-7 − 8 + 10`. Se escribe el menos de verdad en los dos
// sitios.
const MENOS = "\u2212";

export function escribeNumero(n) {
  return n < 0 ? `${MENOS}${ABS(n)}` : String(n);
}

function enParentesis(n) {
  return n < 0 ? `(${escribeNumero(n)})` : String(n);
}

// ── Las cuatro operaciones entre dos números ──────────────────────────────

export function explicaProducto(a, b, simbolo) {
  const mismos = (a < 0) === (b < 0);
  const operacion = simbolo === "·" ? "·" : ":";
  const valor = simbolo === "·" ? ABS(a) * ABS(b) : ABS(a) / ABS(b);
  return `Los signos son ${mismos ? "iguales" : "distintos"}, así que el resultado es `
    + `${mismos ? "positivo" : "negativo"}. Después, ${ABS(a)} ${operacion} ${ABS(b)} = ${valor}.`;
}

export function explicaSuma(a, b) {
  if ((a < 0) === (b < 0)) {
    return `Mismo signo: se suman los valores absolutos (${ABS(a)} + ${ABS(b)} = ${ABS(a) + ABS(b)}) `
      + `y se mantiene el signo, que es ${nombreDeSigno(a)}.`;
  }
  const grande = ABS(a) >= ABS(b) ? a : b;
  const mayor = ABS(grande);
  const menor = Math.min(ABS(a), ABS(b));
  return `Signos distintos: se resta el menor del mayor (${mayor} ${MENOS} ${menor} = ${mayor - menor}) `
    + `y se pone el signo del que tiene mayor valor absoluto, que es ${nombreDeSigno(grande)}.`;
}

// LA RESTA NO SE EXPLICA COMO RESTA, se explica como la suma del opuesto: es
// el concepto 8 del catálogo y lo que hay que entender para el resto del tema.
// Y ENCADENA con la explicación de la suma, porque si no se corta justo antes
// de lo que importa — "y a partir de ahí, como una suma" deja el ejemplo a
// medias, que es como salió en la primera tanda.
export function explicaResta(a, b) {
  return `Restar es sumar el opuesto: ${escribeNumero(a)} ${MENOS} ${enParentesis(b)} = `
    + `${escribeNumero(a)} + ${enParentesis(-b)}. `
    + explicaSuma(a, -b);
}

export function explicaPotencia(base, exponente) {
  const par = exponente % 2 === 0;
  if (ABS(base) === 1) {
    const valor = base > 0 ? 1 : (par ? 1 : -1);
    return `La base es ${escribeNumero(base)}, así que solo cuenta la paridad del exponente: `
      + `${exponente} es ${par ? "par" : "impar"} y el resultado es ${escribeNumero(valor)}. `
      + "No hay que multiplicar nada.";
  }
  const magnitud = ABS(base) ** exponente;
  if (base < 0) {
    return `La base es negativa y el exponente es ${par ? "par" : "impar"}, así que el resultado `
      + `es ${par ? "positivo" : "negativo"}. Y ${ABS(base)} elevado a ${exponente} es ${magnitud}.`;
  }
  return `Base positiva: el resultado también es positivo. ${base} elevado a ${exponente} `
    + `es ${magnitud}.`;
}

// ── Paréntesis y orden ────────────────────────────────────────────────────

// El menos delante de un paréntesis. Es lo que más cuesta del tema, y la
// explicación tiene que decir TODOS los signos: el error típico es cambiar
// solo el primero.
export function explicaMenosDelante() {
  return "El menos de delante cambia el signo de TODO lo que hay dentro del paréntesis, "
    + "no solo del primer número.";
}

export function explicaMasDelante() {
  return "El paréntesis va precedido de +, así que los signos de dentro no cambian: "
    + "se puede quitar tal cual.";
}

export function explicaParentesisPrimero() {
  return "El paréntesis manda: primero se resuelve lo de dentro y después la operación "
    + "de fuera.";
}

// UNA CADENA SE EXPLICA CON LOS PASOS, NO CON LA REGLA.
//
// La primera versión decía solo "se opera de izquierda a derecha, de dos en
// dos", y un test lo pilló: la explicación no contenía ni un número, así que
// no era un ejemplo resuelto — era el enunciado otra vez. Y la cadena es
// justo donde el alumno se pierde, contando signos a mitad de camino. Lo que
// hace falta es ver los parciales.
export function explicaCadena(arbol) {
  const pasos = parcialesDeCadena(arbol);
  if (!pasos || pasos.length < 2) {
    return "Sin paréntesis que manden, se opera de izquierda a derecha, de dos en dos.";
  }
  return `De izquierda a derecha, de dos en dos: ${pasos.join(", ")}.`;
}

// Los resultados intermedios de una cadena, tal como se van escribiendo:
// ["2+9=11", "11−2=9", ...]. Se recorre el árbol por la izquierda, que es el
// orden en que `cadena()` lo construyó y el orden en que se opera.
function parcialesDeCadena(arbol) {
  const piezas = [];
  const baja = (nodo) => {
    if (nodo.tipo === "num") return nodo.valor;
    if (nodo.tipo !== "op" || !SIGNO_DE_OPERADOR[nodo.simbolo]) return null;
    if (nodo.der.tipo !== "num") return null;
    const izq = baja(nodo.izq);
    if (izq === null) return null;
    const valor = SIGNO_DE_OPERADOR[nodo.simbolo](izq, nodo.der.valor);
    if (valor === null) return null;
    piezas.push(
      `${escribeNumero(izq)} ${SIMBOLO_LEGIBLE[nodo.simbolo]} `
      + `${enParentesis(nodo.der.valor)} = ${escribeNumero(valor)}`,
    );
    return valor;
  };
  return baja(arbol) === null ? null : piezas;
}

const SIGNO_DE_OPERADOR = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "·": (a, b) => a * b,
  ":": (a, b) => (b === 0 || a % b !== 0 ? null : a / b),
};

const SIMBOLO_LEGIBLE = { "+": "+", "-": MENOS, "·": "·", ":": ":" };

// QUITAR LOS PARÉNTESIS ES EL EJERCICIO, así que el ejemplo tiene que
// enseñarlo escrito: `7 − (−7 + 8) = 7 + 7 − 8 = 6`. Explicar que "primero se
// resuelve lo de dentro" sería resolver OTRO ejercicio — uno de jerarquía— y
// además le quita al alumno lo único que esta batería practica.
export function explicaQuitarParentesis(arbol, valor) {
  if (!Number.isInteger(valor)) return null;
  const desarrollo = terminosSinParentesis(arbol);
  if (!desarrollo) return null;
  // LA FRASE DEPENDE DE SI LOS SIGNOS CAMBIAN O NO, y la primera versión
  // ponía siempre la del menos: para `7 + (-7 + 8)` decía "el menos de
  // delante cambia el signo", que es FALSO y además enseña lo contrario de lo
  // que hay que hacer. Con un más los signos se quedan como están.
  const regla = desarrollo.invierte ? explicaMenosDelante() : explicaMasDelante();
  return `${regla} Queda ${escribeCadena(desarrollo.terminos)} = ${escribeNumero(valor)}.`;
}

// Los términos de la expresión una vez quitado el paréntesis, con su signo ya
// corregido. Cubre las tres formas que genera `eliminaParentesis`:
// `fuera − (grupo)`, `fuera + (grupo)` y `−(grupo) + fuera`.
function terminosSinParentesis(arbol) {
  if (arbol.tipo !== "op" || (arbol.simbolo !== "+" && arbol.simbolo !== "-")) return null;
  const { simbolo, izq, der } = arbol;

  if (izq.tipo === "neg") {
    const dentro = terminosDeGrupo(izq.hijo);
    const fuera = terminosDeGrupo(der);
    if (!dentro || !fuera) return null;
    // `-(grupo) ± fuera`: el paréntesis lleva el menos delante siempre.
    return {
      terminos: [...dentro.map((t) => -t), ...(simbolo === "-" ? fuera.map((t) => -t) : fuera)],
      invierte: true,
    };
  }

  const fuera = terminosDeGrupo(izq);
  const dentro = terminosDeGrupo(der.tipo === "neg" ? der.hijo : der);
  if (!fuera || !dentro) return null;
  // Un menos delante del paréntesis cambia el signo de TODOS los de dentro;
  // un más los deja como están. Y un `neg` dentro cuenta como otro menos.
  const invierte = (simbolo === "-") !== (der.tipo === "neg");
  return {
    terminos: [...fuera, ...(invierte ? dentro.map((t) => -t) : dentro)],
    invierte,
  };
}

// Aplana una cadena de sumas y restas en una lista de números con signo.
// Devuelve null si hay algo que no sea eso (un producto, una potencia): en ese
// caso no se puede escribir como una simple cadena de términos.
function terminosDeGrupo(nodo) {
  if (!nodo) return null;
  if (nodo.tipo === "num") return [nodo.valor];
  if (nodo.tipo === "neg") {
    const dentro = terminosDeGrupo(nodo.hijo);
    return dentro ? dentro.map((t) => -t) : null;
  }
  if (nodo.tipo !== "op" || (nodo.simbolo !== "+" && nodo.simbolo !== "-")) return null;
  const izq = terminosDeGrupo(nodo.izq);
  const der = terminosDeGrupo(nodo.der);
  if (!izq || !der) return null;
  return [...izq, ...(nodo.simbolo === "-" ? der.map((t) => -t) : der)];
}

// `[7, 7, -8]` → `"7 + 7 − 8"`. El primero va con su signo pegado; los demás
// con el operador separado, como se escribe a mano.
function escribeCadena(terminos) {
  return terminos
    .map((t, i) => (i === 0 ? escribeNumero(t) : `${t < 0 ? MENOS : "+"} ${ABS(t)}`))
    .join(" ");
}

// ── El hueco ──────────────────────────────────────────────────────────────

// CÓMO SE LLAMA EL NÚMERO QUE FALTA, y con qué operación se halla.
//
// La primera versión de esto montaba la frase con un verbo y salía
// *"¿Qué número hay que dividir entre a -35...?"*. El problema no era la
// gramática: era que la frase no decía lo único que hace falta saber, que es
// QUÉ PAPEL juega el hueco en la igualdad. Con el nombre correcto
// —sumando, sustraendo, minuendo, factor, divisor, dividendo— la regla sale
// sola, y además es el vocabulario que el alumno oye en clase.
//
// Cada entrada dice el nombre del hueco y cómo se calcula. `visible` es el
// número que se ve y `total` el resultado de la igualdad.
const PAPEL_DEL_HUECO = {
  // `visible + ___ = total` y `___ + visible = total` son el mismo caso: la
  // suma es conmutativa y el hueco es un sumando en los dos.
  "+:detras": {
    papel: "un sumando",
    como: (v, t) => [`${escribeNumero(t)} ${MENOS} ${enParentesis(v)}`, t - v],
  },
  "+:delante": {
    papel: "un sumando",
    como: (v, t) => [`${escribeNumero(t)} ${MENOS} ${enParentesis(v)}`, t - v],
  },
  // La resta NO es conmutativa, así que aquí sí son dos casos distintos, y
  // son los dos que el currículo pide en "relaciones inversas".
  "-:detras": {
    papel: "el sustraendo",
    como: (v, t) => [`${escribeNumero(v)} ${MENOS} ${enParentesis(t)}`, v - t],
  },
  "-:delante": {
    papel: "el minuendo",
    como: (v, t) => [`${escribeNumero(t)} + ${enParentesis(v)}`, t + v],
  },
  "·:detras": {
    papel: "un factor",
    como: (v, t) => [`${escribeNumero(t)} : ${enParentesis(v)}`, t / v],
  },
  "·:delante": {
    papel: "un factor",
    como: (v, t) => [`${escribeNumero(t)} : ${enParentesis(v)}`, t / v],
  },
};
// `:` va aparte porque su símbolo choca con el separador de la clave.
const PAPEL_DIVISION = {
  detras: {
    papel: "el divisor",
    como: (v, t) => [`${escribeNumero(v)} : ${enParentesis(t)}`, v / t],
  },
  delante: {
    papel: "el dividendo",
    como: (v, t) => [`${escribeNumero(t)} · ${enParentesis(v)}`, t * v],
  },
};

export function explicaHueco({ visible, total, operador, huecoDetras }) {
  const lado = huecoDetras ? "detras" : "delante";
  const entrada = operador === ":" ? PAPEL_DIVISION[lado] : PAPEL_DEL_HUECO[`${operador}:${lado}`];
  if (!entrada) return null;
  const [cuenta, valor] = entrada.como(visible, total);
  return `El hueco es ${entrada.papel}, así que se halla al revés: ${cuenta} = ${escribeNumero(valor)}.`;
}

// ── El despachador: de un árbol a su explicación ──────────────────────────
//
// Devuelve null cuando no sabe explicar la forma. NULL ES UNA RESPUESTA
// VÁLIDA y no un fallo: más vale un apartado resuelto con el resultado y sin
// frase que una frase genérica del tipo "resuelve la operación", que ocupa
// sitio y no dice nada.
export function explicaArbol(arbol, valor = null) {
  if (!arbol || typeof arbol !== "object") return null;
  if (arbol.tipo === "neg") return explicaQuitarParentesis(arbol, valor) || explicaMenosDelante();
  if (arbol.tipo !== "op") return null;

  const { simbolo, izq, der } = arbol;

  // UN PARÉNTESIS A LA DERECHA NO ES UNA CADENA, y distinguirlo importa: la
  // primera versión explicaba `7 + (-7 + 8)` como "se opera de izquierda a
  // derecha", que en esa batería es justo lo contrario de lo que se enseña.
  //
  // En el árbol se ven las dos formas sin ambigüedad: `cadena()` asocia a la
  // IZQUIERDA, así que una cadena tiene el operando compuesto a la izquierda
  // y un número a la derecha. Un grupo entre paréntesis está a la DERECHA.
  const grupoALaDerecha = der?.tipo === "op" || der?.tipo === "neg";
  if (grupoALaDerecha) {
    if (simbolo === "-" || simbolo === "+") {
      const desarrollo = explicaQuitarParentesis(arbol, valor);
      if (desarrollo) return desarrollo;
      return simbolo === "-" ? explicaMenosDelante() : explicaMasDelante();
    }
    return explicaParentesisPrimero();
  }
  if (izq?.tipo === "neg") {
    return explicaQuitarParentesis(arbol, valor) || explicaMenosDelante();
  }
  if (izq?.tipo === "op") return simbolo === "^" ? null : explicaCadena(arbol);

  const a = izq?.valor;
  const b = der?.valor;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;

  switch (simbolo) {
    case "+": return explicaSuma(a, b);
    case "-": return explicaResta(a, b);
    case "·":
    case ":": return explicaProducto(a, b, simbolo);
    case "^": return explicaPotencia(a, b);
    default: return null;
  }
}

// La explicación de un apartado ya construido, sea una expresión o un hueco.
export function explicaApartado(apartado) {
  if (!apartado) return null;
  // Un hueco se reconoce porque lleva `operador` y `total`: ver hueco.js.
  if (apartado.operador !== undefined && apartado.total !== undefined) {
    return explicaHueco(apartado);
  }
  return explicaArbol(apartado.arbol, apartado.solucion);
}
