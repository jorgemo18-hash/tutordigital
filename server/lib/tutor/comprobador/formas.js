// ¿EN QUÉ FORMA ESTÁ UNA LÍNEA? Las formas de `termina` de los métodos
// (tutor/metodos/esquema.js → FORMAS), decididas sobre el árbol de la línea.
//
// Solo se miran líneas ya EQUIVALENTES al enunciado (lineas.js): aquí no se
// decide si está bien, sino hasta dónde ha llegado. Devuelve true/false, o
// null para las formas que el código no puede decidir (las juzga el tutor).
import { evalua, variables } from "../../verificador/expresionDeTexto.js";

const ADITIVA = new Set(["+", "-"]);
const conX = (a) => variables(a).has("x");
const esSuma = (a) => ADITIVA.has(a.op);

// 7, −7, 7/2, −7/2: un número ya escrito como resultado, sin cuentas.
export function esValorEscrito(a) {
  if ("num" in a) return true;
  if (a.op === "neg") return esValorEscrito(a.a);
  return a.op === "/" && "num" in a.a && "num" in a.b;
}

// Un paréntesis que todavía hay que quitar: algo que multiplica, divide o
// cambia de signo a una suma que lleva x. «(−3)·x» no cuenta.
export function tieneParentesisConX(a) {
  if (!a || "num" in a || "variable" in a) return false;
  if (["*", "/", "neg", "^"].includes(a.op) && [a.a, a.b].some((h) => h && esSuma(h) && conX(h))) return true;
  return [a.a, a.b, ...(a.args || [])].some((h) => h && tieneParentesisConX(h));
}

// 3x, x, −x, −3x: un solo término con x y sin número suelto.
export function esMonomioX(a) {
  if (!conX(a) || esSuma(a) || tieneParentesisConX(a)) return false;
  if ("variable" in a) return true;
  if (a.op === "neg") return esMonomioX(a.a);
  if (a.op === "*") return (esMonomioX(a.a) && esValorEscrito(a.b)) || (esValorEscrito(a.a) && esMonomioX(a.b));
  return false;
}

function terminos(a, signo = 1, salida = []) {
  if (a.op === "+") { terminos(a.a, signo, salida); terminos(a.b, signo, salida); return salida; }
  if (a.op === "-") { terminos(a.a, signo, salida); terminos(a.b, -signo, salida); return salida; }
  salida.push(a);
  return salida;
}

export function esExpresionReducida(a) {
  if (tieneParentesisConX(a)) return false;
  const ts = terminos(a);
  const conLetra = ts.filter(conX);
  const sinLetra = ts.filter((t) => !conX(t));
  return conLetra.length <= 1 && sinLetra.length <= 1 && conLetra.every(esMonomioX) && sinLetra.every(esValorEscrito);
}

const ceroEn = (a) => Math.abs(evalua(a, { x: 0 })) < 1e-12;

// Las de ecuación reciben { izq, der }; las de expresión, el árbol.
const DE_ECUACION = {
  sin_parentesis: ({ izq, der }) => !tieneParentesisConX(izq) && !tieneParentesisConX(der),
  x_en_un_lado: ({ izq, der }) => {
    const [conLetra, sinLetra] = conX(izq) ? [izq, der] : [der, izq];
    return conX(conLetra) && !conX(sinLetra) && ceroEn(conLetra) && !tieneParentesisConX(conLetra);
  },
  ax_igual_b: ({ izq, der }) => (esMonomioX(izq) && esValorEscrito(der)) || (esMonomioX(der) && esValorEscrito(izq)),
  x_despejada: ({ izq, der }) => ("variable" in izq && esValorEscrito(der)) || ("variable" in der && esValorEscrito(izq)),
  ecuacion_planteada: () => null,
};

const DE_EXPRESION = {
  expresion_equivalente: () => true,
  expresion_reducida: (a) => esExpresionReducida(a),
  sin_parentesis: (a) => !tieneParentesisConX(a),
  sustitucion: (a) => !conX(a),
  valor: (a) => !conX(a) && esValorEscrito(a),
};

export function esDecidible(forma, tipo) {
  const f = (tipo === "ecuacion" ? DE_ECUACION : DE_EXPRESION)[forma];
  return Boolean(f) && forma !== "ecuacion_planteada";
}

// forma: clave de FORMAS · linea: lo que devuelve comprobarLineas para esa línea.
export function cumpleForma(forma, linea, tipo) {
  const tabla = tipo === "ecuacion" ? DE_ECUACION : DE_EXPRESION;
  const f = tabla[forma];
  if (!f) return null;
  return f(linea.arbol);
}
