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

export function lineasDeCuentas(texto) {
  const salida = [];
  for (const linea of String(texto || "").split(/\n|;|\s+y luego\s+|\s+→\s+/)) {
    const limpia = linea.replace(/^\s*(?:[a-h]\)|\d+[.)]\s)\s*/i, "");
    for (const trozo of limpia.match(TROZO) || []) {
      try {
        const n = normaliza(trozo);
        if (/[=+*/^]|\d-|x-|\)-/.test(n)) salida.push(trozo.trim());
      } catch { /* no es una cuenta */ }
    }
  }
  return salida;
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
