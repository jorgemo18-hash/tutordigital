import { reuneApartados } from "../../ejercicio.js";
import { dec, producto, cociente, porPotencia, entrePotencia, texto, latex, alAzar } from "./decimal.js";

// DECIMALES, OBJETIVO 4: MULTIPLICAR Y DIVIDIR (conceptos 6 y 7). Saber
// A.3: «Operaciones…» y «Efecto de las operaciones aritméticas con números
// enteros, fracciones y expresiones decimales».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   6 al multiplicar, poner en el resultado los decimales de UN factor
//     (0,3 · 0,2 = 0,6);
//   7 multiplicar por 10, 100 o 1000 AÑADIENDO CEROS (3,4 · 10 = 3,40), y
//     al dividir, mover la coma al revés;
//   8 dividir entre un decimal sin mover la coma del dividendo
//     (8 : 0,4 → 8 : 4 = 2);
//   9 creer que multiplicar siempre hace más grande y dividir más pequeño.

const POTENCIAS = [[10, 1], [100, 2], [1000, 3]];

// Divisores decimales de una cifra significativa (y alguno de dos): la
// división que queda tras quitar la coma es de las que se hacen a mano.
const DIVISORES_DECIMALES = [dec(2, 1), dec(3, 1), dec(4, 1), dec(5, 1), dec(6, 1), dec(8, 1), dec(12, 1), dec(15, 1), dec(25, 1), dec(25, 2)];

// ── "Por y entre 10, 100 y 1000" (dificultad 1) ─────────────────────────
export function porPotenciaDeDiez(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const multiplica = i % 2 === 0;
    i += 1;
    const [p, k] = azar.elige(POTENCIAS);
    const a = alAzar(azar, { e: azar.entero(1, 3), min: 0, max: 99 });
    if (!a) return null;
    const r = multiplica ? porPotencia(a, k) : entrePotencia(a, k);
    const op = multiplica ? "\\cdot" : ":";
    const opT = multiplica ? "·" : ":";
    // Error 7: por → ceros pegados detrás; entre → la coma hacia el otro lado.
    const mal = multiplica ? `${texto(a)}${"0".repeat(k)}` : texto(porPotencia(a, k));
    return {
      latex: `$${latex(a)} ${op} ${p} =$ ___`,
      latexResuelto: `$${latex(a)} ${op} ${p} = ${latex(r)}$`,
      texto: `${texto(a)} ${opT} ${p} = ___`,
      solucion: texto(r),
      comaMal: mal,
      razon: `${multiplica ? "Por" : "Entre"} ${p}, la coma se mueve ${k} ${k === 1 ? "lugar" : "lugares"} a la ${multiplica ? "derecha" : "izquierda"}${multiplica ? " (con ceros si faltan cifras)" : " (con ceros delante si faltan)"}: ${texto(r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "por_potencia_de_diez",
    arquetipo: "Multiplica y divide por 10, 100 y 1000",
    enunciado: "Calcula moviendo la coma:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Multiplica" (dificultad 2) ─────────────────────────────────────────
// De 5 a 7: decimal por entero y decimal por decimal, con cuentas cortas
// (un factor de una o dos cifras): se practica dónde va la coma, no la
// multiplicación larga.
export function multiplicaDecimales(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const dosDecimales = i % 3 !== 0;
    i += 1;
    const a = alAzar(azar, { e: azar.entero(1, 2), min: 0, max: 9 });
    const b = dosDecimales ? alAzar(azar, { e: 1, min: 0, max: 3 }) : dec(azar.entero(2, 9));
    if (!a || !b || b.n === 1) return null;
    const r = producto(a, b);
    // Error 6: solo los decimales del que más tiene.
    const mal = dosDecimales ? texto(dec(a.n * b.n, Math.max(a.e, b.e))) : null;
    return {
      latex: `$${latex(a)} \\cdot ${latex(b)} =$ ___`,
      latexResuelto: `$${latex(a)} \\cdot ${latex(b)} = ${latex(r)}$`,
      texto: `${texto(a)} · ${texto(b)} = ___`,
      solucion: texto(r),
      decimalesDeUno: mal,
      razon: `Se multiplica sin comas, ${a.n} · ${b.n} = ${texto(dec(a.n * b.n))}, y se ponen tantos decimales como tienen los dos factores juntos (${a.e}${b.e ? ` + ${b.e}` : ""}): ${texto(r, a.e + b.e)}${r.e < a.e + b.e ? `, que es ${texto(r)}` : ""}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "multiplica_decimales",
    arquetipo: "Multiplica números decimales",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "Divide" (dificultad 2) ─────────────────────────────────────────────
// De 5 a 7, siempre exactas: la mitad un decimal entre un entero (18,6 : 4)
// y la mitad entre un decimal (8 : 0,4, 2,7 : 0,3), que se convierte en
// una división entre un entero multiplicando los dos por lo mismo.
export function divideDecimales(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const entreDecimal = i % 2 === 1;
    i += 1;
    // Se elige el divisor y el resultado; el dividendo sale de ellos, así
    // que la división es exacta.
    const b = entreDecimal ? azar.elige(DIVISORES_DECIMALES) : dec(azar.entero(2, 9));
    const res = entreDecimal && azar.suerte(0.5) ? dec(azar.entero(2, 30)) : alAzar(azar, { e: 1, min: 1, max: 12 });
    if (!res) return null;
    const a = producto(res, b);
    if (a.e > 2) return null;
    const k = b.e;
    // Error 8: el divisor sin coma y el dividendo igual.
    const sinComa = entreDecimal ? cociente(a, dec(b.n), 3) : null;
    return {
      latex: `$${latex(a)} : ${latex(b)} =$ ___`,
      latexResuelto: `$${latex(a)} : ${latex(b)} = ${latex(res)}$`,
      texto: `${texto(a)} : ${texto(b)} = ___`,
      solucion: texto(res),
      sinMoverDividendo: sinComa ? texto(sinComa) : null,
      razon: entreDecimal
        ? `El divisor no puede tener coma: se multiplican los dos por ${10 ** k}, ${texto(porPotencia(a, k))} : ${b.n} = ${texto(res)}.`
        : `Se divide como con enteros y la coma se sube al cociente al llegar a ella: ${texto(a)} : ${texto(b)} = ${texto(res)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "divide_decimales",
    arquetipo: "Divide números decimales",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "¿Mayor o menor?" (dificultad 2) ────────────────────────────────────
// De 6 a 8, sin hacer la cuenta: ¿8 · 0,5 es mayor o menor que 8? La
// mitad con un número menor que 1 (donde multiplicar hace MÁS PEQUEÑO y
// dividir MÁS GRANDE) y la mitad con uno mayor que 1.
export function efectoDeOperar(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const menorQueUno = i % 2 === 0;
    const multiplica = (i >> 1) % 2 === 0;
    i += 1;
    const n = azar.entero(4, 30);
    const f = menorQueUno ? dec(azar.entero(1, 9), 1) : dec(azar.entero(11, 29), 1);
    if (f.e === 0) return null;
    const agranda = multiplica !== menorQueUno;
    const op = multiplica ? "\\cdot" : ":";
    const opT = multiplica ? "·" : ":";
    const sol = agranda ? "mayor" : "menor";
    return {
      latex: `$${n} ${op} ${latex(f)}$ es ___ que $${n}$`,
      latexResuelto: `$${n} ${op} ${latex(f)}$ es ${sol} que $${n}$`,
      texto: `${n} ${opT} ${texto(f)} es ___ que ${n}`,
      solucion: sol,
      // Error 9: multiplicar siempre agranda, dividir siempre achica.
      siempre: multiplica ? "mayor" : "menor",
      razon: `${texto(f)} es ${menorQueUno ? "menor" : "mayor"} que 1. ${multiplica ? "Multiplicar" : "Dividir"} por un número ${menorQueUno ? "menor" : "mayor"} que 1 da un resultado ${sol} (${multiplica ? `${texto(f)} veces ${n}` : `cuántas veces cabe ${texto(f)} en ${n}`}).`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "efecto_de_operar",
    arquetipo: "Decide sin calcular si el resultado es mayor o menor",
    enunciado: "Sin hacer la cuenta, escribe mayor o menor:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
