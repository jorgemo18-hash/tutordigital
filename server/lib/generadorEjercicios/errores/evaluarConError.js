import { OPERADORES } from "../expresion.js";

// UNA EXPRESIÓN RESUELTA COMO LA RESOLVERÍA UN ALUMNO CON UN ERROR CONCRETO.
//
// Es el evaluador de expresion.js con una "creencia equivocada" puesta: el
// alumno con el error 2 suma los valores absolutos cada vez que los signos
// son distintos, y lo hace EN TODA la expresión, no en un sitio. Un error de
// concepto es sistemático; si fuera de una vez, sería un descuido (el 15),
// que no se predice.
//
// Lo que sale es la respuesta-trampa: lo que escribiría ese alumno. Si con
// ese error la expresión da lo mismo que bien hecha, ese apartado NO sirve
// para detectarlo, y quien llama no lo apunta.
//
// Devuelve un entero o `null` (la cuenta del alumno no llega a un entero:
// una división que ya no es exacta, por ejemplo). Nunca lanza por el
// ejercicio; un árbol roto sí lanza, porque es un bug.
//
// CADA ERROR, TAL COMO LO ESCRIBIÓ JORGE EN SU CATÁLOGO (migración 120):
//   1  "8 - (-5) = 8 - 5": el número negativo escrito a la derecha de una
//      suma o una resta se lee sin su signo.
//   2  "-8 + 5 = -13": con signos distintos suma los valores absolutos (y
//      pone el signo del mayor).
//   3  "-9 + 4 = +5": con signos distintos resta bien y pone el otro signo.
//   5  "(-4)·(-3) = -12": en productos y cocientes con algún negativo, el
//      signo al revés.
//   6  "5 - (-3) = 2": restar un negativo hace más pequeño.
//   7  "8 - (-3 + 5) = 8 - 3 + 5": quita el paréntesis que lleva un menos
//      delante SIN cambiar ningún signo de dentro (es la variante del
//      ejemplo; la de "cambia solo el primero" está anotada para Jorge).
//   8  "3 + 4·(-2) = 7·(-2)": opera en el orden en que está escrito, sin
//      jerarquía (los paréntesis sí los respeta: los ve).
//   10 "-7 + (-2) = +9": "menos y menos es más" aplicado a la suma.
// Los errores 4, 9, 11, 12 y 13 no son de expresiones: ver trampasDelApartado.
export const ERRORES_DE_EXPRESION = [1, 2, 3, 5, 6, 7, 8, 10];

const TOPE = 1000000;

class NoEsEntero extends Error {}

export function evaluarConError(arbol, error) {
  try {
    return calcula(arbol, error);
  } catch (err) {
    if (err instanceof NoEsEntero) return null;
    throw err;
  }
}

function entero(v) {
  if (!Number.isFinite(v) || !Number.isInteger(v) || Math.abs(v) > TOPE) throw new NoEsEntero();
  return v === 0 ? 0 : v; // sin -0
}

// Los términos de una suma o resta encadenada, con su signo: `-3 + 5 - 2` son
// (+, -3), (+, 5), (-, 2). Solo baja por la izquierda: un grupo a la derecha
// va entre paréntesis y es un término entero.
function terminos(nodo) {
  if (nodo.tipo !== "op" || (nodo.simbolo !== "+" && nodo.simbolo !== "-")) return [{ signo: 1, nodo }];
  return [...terminos(nodo.izq), { signo: nodo.simbolo === "+" ? 1 : -1, nodo: nodo.der }];
}

const esAditiva = (n) => n.tipo === "op" && (n.simbolo === "+" || n.simbolo === "-");

// Error 7: el grupo se "abre" sin tocar ningún signo de dentro.
function grupoSinCambiarSignos(grupo, error) {
  return terminos(grupo).reduce((s, t) => s + t.signo * calcula(t.nodo, error), 0);
}

function calcula(nodo, error) {
  if (nodo.tipo === "num") return nodo.valor;
  if (nodo.tipo === "neg") {
    if (error === 7 && esAditiva(nodo.hijo)) return entero(grupoSinCambiarSignos(nodo.hijo, error));
    return entero(-calcula(nodo.hijo, error));
  }
  if (error === 8 && nodo.simbolo !== "^") return entero(deIzquierdaADerecha(nodo, error));

  const a = calcula(nodo.izq, error);
  if (error === 7 && nodo.simbolo === "-" && esAditiva(nodo.der)) {
    return entero(a + grupoSinCambiarSignos(nodo.der, error));
  }
  const b = calcula(nodo.der, error);
  return entero(opera(nodo.simbolo, a, b, nodo.der, error));
}

function opera(simbolo, a, b, nodoDer, error) {
  switch (simbolo) {
    case "+":
    case "-":
      return aditiva(simbolo, a, b, nodoDer, error);
    case "·": {
      const bien = a * b;
      return error === 5 && (a < 0 || b < 0) ? -bien : bien;
    }
    case ":": {
      if (b === 0 || a % b !== 0) throw new NoEsEntero();
      const bien = a / b;
      return error === 5 && (a < 0 || b < 0) ? -bien : bien;
    }
    case "^":
      if (b < 0 || b > 12) throw new NoEsEntero();
      return a ** b;
    default:
      throw new Error(`operador sin implementar: ${simbolo}`);
  }
}

function aditiva(simbolo, a, b, nodoDer, error) {
  // 1: el negativo escrito a la derecha (y no el hueco que escribe el propio
  // alumno, ver trampasDeHueco.js) se lee sin signo.
  const leido = error === 1 && nodoDer?.tipo === "num" && nodoDer.valor < 0 && !nodoDer.hueco ? -b : b;
  if (error === 6 && simbolo === "-" && leido < 0) return a - Math.abs(leido);
  const sumando = simbolo === "+" ? leido : -leido;
  const bien = a + sumando;
  // "Signos distintos" CON UN NEGATIVO ESCRITO: `50 - 14` también suma
  // signos distintos (50 + (-14)), pero ahí no hay ningún negativo a la
  // vista y nadie aplica una regla de enteros. Salió en la primera tabla.
  const hayNegativo = a < 0 || leido < 0;
  const distintos = hayNegativo && a !== 0 && sumando !== 0 && Math.sign(a) !== Math.sign(sumando);
  if (error === 2 && distintos) {
    const signo = Math.abs(a) >= Math.abs(sumando) ? Math.sign(a) : Math.sign(sumando);
    return signo * (Math.abs(a) + Math.abs(sumando));
  }
  if (error === 3 && distintos) return -bien;
  if (error === 10 && a < 0 && sumando < 0) return -bien;
  return bien;
}

// Error 8: la expresión como se lee, de izquierda a derecha. Un grupo entre
// paréntesis (los que imprime expresion.js) es una pieza que se calcula
// aparte —con el mismo error dentro—; lo demás se encadena en el orden del
// papel.
function deIzquierdaADerecha(nodo, error) {
  const piezas = [];
  const ops = [];
  aplana(nodo, piezas, ops, error);
  let valor = piezas[0];
  ops.forEach((s, i) => { valor = opera(s, valor, piezas[i + 1], null, 0); });
  return valor;
}

function aplana(nodo, piezas, ops, error) {
  const p = OPERADORES[nodo.simbolo].precedencia;
  const va = (hijo, lado) => {
    const inline = hijo.tipo === "op" && hijo.simbolo !== "^"
      && (lado === "izq" ? OPERADORES[hijo.simbolo].precedencia >= p : OPERADORES[hijo.simbolo].precedencia > p);
    if (inline) aplana(hijo, piezas, ops, error);
    else piezas.push(calcula(hijo, error));
  };
  va(nodo.izq, "izq");
  ops.push(nodo.simbolo);
  va(nodo.der, "der");
}
