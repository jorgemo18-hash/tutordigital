import { termino, reduce, textoLineal } from "../generadores/algebra/terminos.js";

// LAS RESPUESTAS-TRAMPA DEL TEMA ÁLGEBRA (migración 138). Mismo contrato
// que las demás (trampasDelApartado.js); los números son los de ESTE tema.
export const ERRORES_ALGEBRA = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000501", categoria: "interpretacion", corto: "El doble de la suma sin paréntesis" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000502", categoria: "conceptual", corto: "Pega el coeficiente y el número (3x con x = 4 → 34)" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000503", categoria: "conceptual", corto: "Junta términos que no son semejantes" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000504", categoria: "procedimiento", corto: "Multiplica solo el primer término del paréntesis" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000505", categoria: "signo", corto: "Pasa un término sin cambiarle el signo" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000506", categoria: "procedimiento", corto: "Pasa restando lo que multiplica" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000507", categoria: "procedimiento", corto: "Divide antes de pasar el término" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000508", categoria: "procedimiento", corto: "En la ecuación, el paréntesis solo al primero" },
  { numero: 9, id: "c2000000-0000-4000-8000-000000000509", categoria: "conceptual", corto: "x² como el doble de x" },
];

// Error 2: el coeficiente pegado al valor, solo con x positiva de una cifra
// (con x = −2 o x = 12 "pegarlos" no da un número que nadie escribiría).
function pegado({ a, b, x }) {
  if (x < 1 || x > 9) return null;
  return Number(`${a}${x}`) + b;
}

export const TRAMPAS_ALGEBRA = {
  traduce_enunciado: (a) => [{ error: 1, respuesta: a.trampa }],
  valor_numerico: (a) => (a.cuadrado
    ? [{ error: 9, respuesta: 2 * a.x + a.b }]
    : [{ error: 2, respuesta: pegado(a) }]),
  reduce_semejantes: (a) => {
    const r = reduce(a.ts);
    return [{ error: 3, respuesta: textoLineal({ a: r.a + r.b, b: 0 }) }];
  },
  reduce_con_parentesis: (a) => [{ error: 4, respuesta: textoLineal(reduce([termino(a.a, true), termino(a.b), termino(a.c, true), termino(a.d)])) }],
  ecuacion_suma_resta: (a) => [{ error: 5, respuesta: a.conError5 }],
  ecuacion_producto_cociente: (a) => [{ error: 6, respuesta: a.conError6 }],
  ecuacion_dos_pasos: (a) => [{ error: 5, respuesta: a.conError5 }, { error: 7, respuesta: a.conError7 }],
  ecuacion_x_dos_lados: (a) => [{ error: 5, respuesta: a.conError5 }],
  ecuacion_con_parentesis: (a) => [{ error: 8, respuesta: a.conError8 }],
};
