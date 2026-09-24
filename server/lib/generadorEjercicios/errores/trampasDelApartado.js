import { num, op } from "../expresion.js";
import { evaluarConError, ERRORES_DE_EXPRESION } from "./evaluarConError.js";
import { TRAMPAS_DIVISIBILIDAD } from "./trampasDivisibilidad.js";
import { TRAMPAS_POTENCIAS_RAICES } from "./trampasPotenciasRaices.js";
import { TRAMPAS_FRACCIONES } from "./trampasFracciones.js";

// LAS RESPUESTAS-TRAMPA DE UN APARTADO: qué escribiría un alumno con cada
// error predecible (erroresPredecibles.js). NUNCA se imprimen: van con la
// hoja guardada para que, al corregir, "falló el 3b" pase a ser "escribió
// 13, que es lo que da el error 1" (nivel 2 del plan de Recursos).
//
// Solo se apunta un error si su respuesta es DISTINTA de la correcta: si
// con el error sale lo mismo, ese apartado no sirve para detectarlo.
//
// Devuelve [{ error, respuesta }] con la respuesta en TEXTO, igual que la
// columna `respuesta` de la migración 119: hay respuestas que son un
// número, un signo (">") o una lista ("-9 < -3 < 2").
// Una lista ordenada se escribe con "<"; las demás listas (los puntos de
// una recta, los términos de una serie), con comas.
const aTexto = (v, separador = ", ") => (Array.isArray(v) ? v.join(separador) : String(v));
const SEPARADOR = { ordena_lista: " < " };

function distintas(correcta, candidatas, separador) {
  const bien = aTexto(correcta, separador);
  return candidatas
    .filter(({ respuesta }) => respuesta !== null && respuesta !== undefined && aTexto(respuesta, separador) !== bien)
    .map(({ error, respuesta }) => ({ error, respuesta: aTexto(respuesta, separador) }));
}

// Una expresión: se resuelve con cada error.
export function trampasDeExpresion(arbol, solucion) {
  return distintas(solucion, ERRORES_DE_EXPRESION.map((error) => ({ error, respuesta: evaluarConError(arbol, error) })));
}

// Una igualdad con hueco (`___ - (-5) = 14`): lo que escribiría el alumno es
// el número que, CON SU ERROR, hace que la cuenta le dé el total. Se busca
// probando; si ninguno o varios lo cumplen, ese error no deja una respuesta
// única y no se apunta (mejor nada que una trampa a cara o cruz).
export const RANGO_DEL_HUECO = 400;

export function trampasDeHueco({ arbol, huecoDetras, total, solucion }) {
  const conX = (x) => {
    const hueco = { ...num(x), hueco: true };
    return huecoDetras ? op(arbol.simbolo, arbol.izq, hueco) : op(arbol.simbolo, hueco, arbol.der);
  };
  return distintas(solucion, ERRORES_DE_EXPRESION.map((error) => {
    const cumplen = [];
    for (let x = -RANGO_DEL_HUECO; x <= RANGO_DEL_HUECO && cumplen.length < 2; x += 1) {
      if (evaluarConError(conX(x), error) === total) cumplen.push(x);
    }
    return { error, respuesta: cumplen.length === 1 ? cumplen[0] : null };
  }));
}

// Error 4: los negativos se ordenan "por el número sin signo" (-8 > -3), y
// entre un negativo y un positivo manda el valor absoluto (-8 > 3).
const valorLeidoPorElError4 = (n) => Math.abs(n);

function comparaConError4(x, y) {
  const a = valorLeidoPorElError4(x);
  const b = valorLeidoPorElError4(y);
  return a === b ? null : (a < b ? "<" : ">");
}

// En una lista, el alumno pone primero los negativos (sabe que van antes)
// pero los ordena por su valor absoluto: -1, -3, -8, y luego 0 y positivos.
function ordenaConError4(lista) {
  const negativos = lista.filter((n) => n < 0).sort((p, q) => Math.abs(p) - Math.abs(q));
  const resto = lista.filter((n) => n >= 0).sort((p, q) => p - q);
  return [...negativos, ...resto];
}

const opuesto = (n) => 0 - n || 0;

// Encadenados: el error 11 deja el valor absoluto como está; el 12, el opuesto.
function encadenadoCon(error, numero, pasos) {
  const paso = { abs: error === 11 ? (x) => x : Math.abs, op: error === 12 ? (x) => x : opuesto };
  return pasos.reduce((x, p) => paso[p](x), numero);
}

const POR_BATERIA = {
  asocia_entero_situacion: (a) => [{ error: 9, respuesta: opuesto(a.solucion) }],
  compara_enteros: (a) => [{ error: 4, respuesta: comparaConError4(...a.pareja) }],
  ordena_lista: (a) => [{ error: 4, respuesta: ordenaConError4(a.lista) }],
  valor_absoluto: (a) => [{ error: 11, respuesta: a.numero }],
  escribe_opuesto: (a) => [{ error: 12, respuesta: a.numero }],
  encadenados_opuesto_absoluto: (a) => [11, 12].map((error) => ({ error, respuesta: encadenadoCon(error, a.numero, a.pasos) })),
  // Las del tema Divisibilidad (con SUS números de error: ver el archivo).
  ...TRAMPAS_DIVISIBILIDAD,
  ...TRAMPAS_POTENCIAS_RAICES,
  ...TRAMPAS_FRACCIONES,
};

export function trampasDelApartado(clave, apartado) {
  if (!apartado || apartado.resuelto) return [];
  if (POR_BATERIA[clave]) return distintas(apartado.solucion, POR_BATERIA[clave](apartado), SEPARADOR[clave]);
  if (apartado.arbol && apartado.total !== undefined && apartado.huecoDetras !== undefined) return trampasDeHueco(apartado);
  if (apartado.arbol && typeof apartado.solucion === "number") return trampasDeExpresion(apartado.arbol, apartado.solucion);
  return [];
}

// Lo que se guarda con la hoja, por apartado: la solución y sus trampas. El
// ejemplo resuelto va marcado y sin trampas (el alumno no lo contesta).
export function respuestasDe(ejercicio) {
  return (ejercicio.apartados || []).map((a) => ({
    solucion: aTexto(a.solucion, SEPARADOR[ejercicio.clave]),
    ...(a.resuelto ? { ejemplo: true } : {}),
    trampas: trampasDelApartado(ejercicio.clave, a),
  }));
}
