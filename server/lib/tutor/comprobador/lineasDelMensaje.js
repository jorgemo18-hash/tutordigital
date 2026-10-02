// LAS LÍNEAS DE CUENTAS DE UN MENSAJE DEL ALUMNO, y de qué apartado habla.
//
// Un mensaje mezcla palabras y cuentas («he hecho esto: 3x = 15 y luego
// x = 5»). Aquí se separan las líneas que el comprobador puede leer: las que
// tienen un «=» o son una expresión sin letras raras. El resto es
// conversación, y la lleva el tutor.
//
// El apartado: si el alumno lo dice («b)», «apartado c»), se usa. Si no, el
// que tenga una referencia equivalente a la primera línea, si es solo uno.
// Con dos candidatos se pregunta: mejor preguntar que corregir otro
// ejercicio.
import { normaliza } from "./notacionDelAlumno.js";
import { comprobarLineas } from "./lineas.js";

const TROZO = /[0-9x(−-][0-9x+\-−–*/·×:÷=()²³ ,.]*[0-9x)²³]/g;
// Separadores de pasos que se escriben en la MISMA línea: flechas, «y
// luego», punto y coma, y la coma seguida de espacio o de una x («3x=15,
// x=5»; la coma decimal «2,5» no lleva espacio).
const SEPARADORES = /\n|;|\s+y luego\s+|\s*(?:→|⇒|=>|->)\s*|,(?=\s|x)/;
// Dos ecuaciones pegadas con un espacio: «2x + 6 = 14 2x = 8». El corte va
// entre un número, una x o un paréntesis y otro número, x o paréntesis, y
// solo si los dos trozos tienen su «=» (si no, «3 x» sería un corte).
const PEGADAS = /(?<=[\dx)²³])\s+(?=[\dx(])/;

function separaPegadas(trozo) {
  const partes = trozo.split(PEGADAS);
  if (partes.length < 2) return [trozo];
  const juntas = [];
  for (const p of partes) {
    if (juntas.length && !(p.includes("=") && juntas[juntas.length - 1].includes("="))) juntas[juntas.length - 1] += ` ${p}`;
    else juntas.push(p);
  }
  return juntas;
}

// Las cuentas del mensaje, una por paso, tal como las escribió.
export function lineasDeCuentas(texto) {
  const salida = [];
  for (const linea of String(texto || "").split(SEPARADORES)) {
    const limpia = (linea || "").replace(/^\s*(?:[a-h]\)|\d+[.)]\s)\s*/i, "");
    for (const trozo of (limpia.match(TROZO) || []).flatMap(separaPegadas)) {
      try {
        const n = normaliza(trozo);
        if (/[=+*/^]|\d-|x-|\)-/.test(n)) salida.push(trozo.trim());
      } catch { /* no es una cuenta */ }
    }
  }
  return salida;
}

// LA CADENA DE IGUALES. Muchos alumnos encadenan: «3x = 19 − 4 = 15» o
// «x = 15 : 3 = 5». En una ecuación quiere decir «3x = 19 − 4» y «3x = 15»:
// el primer miembro con cada uno de los siguientes. En una expresión
// («2(x − 4) + 2x = 2x − 8 + 2x = 4x − 8»), cada miembro es un paso.
export function expandirCadena(linea, tipo) {
  const miembros = String(linea).split("=").map((m) => m.trim()).filter((m) => m && !/^_+$/.test(m));
  if (tipo === "expresion") return miembros.length ? miembros : [linea];
  if (miembros.length <= 2) return [linea];
  return miembros.slice(1).map((m) => `${miembros[0]} = ${m}`);
}

const LETRAS = "abcdefgh";

export function apartadoNombrado(texto) {
  const m = String(texto || "").match(/(?:^|\s|\()(?:apartado\s+)?([a-h])\)/i) || String(texto || "").match(/apartado\s+([a-h])\b/i);
  return m ? LETRAS.indexOf(m[1].toLowerCase()) : -1;
}

// Los números de una línea, sin signo: «3x = 19 + 4» → [3, 19, 4].
function numerosDe(texto) {
  return (String(texto).match(/\d+(?:[.,]\d+)?/g) || []).map((n) => Number(n.replace(",", ".")));
}

// ¿Puede ser esta línea el primer paso de este apartado? Si es equivalente,
// seguro. Si no (puede estar mal: es justo lo que hay que corregir), cuando
// todos sus números salen del enunciado y son al menos dos.
function encaja(linea, apartado) {
  if (!apartado.referencia) return false;
  if (comprobarLineas({ referencia: apartado.referencia, lineas: [linea] }).lineas[0].equivalente === true) return true;
  const deLaLinea = numerosDe(linea);
  const delEnunciado = numerosDe(apartado.referencia.enunciado);
  return deLaLinea.length >= 2 && deLaLinea.every((n) => delEnunciado.includes(n));
}

// apartados: [{ referencia }] en el orden de la hoja (sin el ejemplo).
// abierto: el apartado del último envío si aún no lo terminó (sigue con él).
export function apartadoDelMensaje({ texto, lineas, apartados, abierto = null }) {
  const nombrado = apartadoNombrado(texto);
  if (nombrado >= 0 && nombrado < apartados.length) return { indice: nombrado, como: "nombrado" };
  if (!lineas.length) return { indice: null, como: "sin_lineas" };
  const candidatos = apartados.map((a, i) => (encaja(lineas[0], a) ? i : null)).filter((i) => i !== null);
  if (candidatos.length === 1) return { indice: candidatos[0], como: "reconocido" };
  if (abierto != null && (candidatos.length === 0 || candidatos.includes(abierto))) return { indice: abierto, como: "sigue" };
  return { indice: null, como: candidatos.length ? "ambiguo" : "ninguno", candidatos };
}
