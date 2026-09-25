// LAS RESPUESTAS-TRAMPA DEL TEMA NÚMEROS NATURALES (migración 141). Mismo
// contrato que las demás (trampasDelApartado.js); los números son los de
// ESTE tema.
export const ERRORES_NATURALES = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000801", categoria: "procedimiento", corto: "Redondea cortando" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000802", categoria: "conceptual", corto: "Confunde la cifra con su valor" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000803", categoria: "procedimiento", corto: "Olvida el resto en la prueba de la división" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000804", categoria: "procedimiento", corto: "Distributiva solo al primer sumando" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000805", categoria: "conceptual", corto: "Suma las opciones en vez de multiplicarlas" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000806", categoria: "conceptual", corto: "Cuenta dos veces lo que es lo mismo" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000807", categoria: "interpretacion", corto: "No piensa qué hacer con el resto" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000808", categoria: "procedimiento", corto: "Aplica el truco de cálculo mental a medias" },
];

export const TRAMPAS_NATURALES = {
  redondea_natural: (a) => [{ error: 1, respuesta: a.cortado }],
  valor_de_la_cifra: (a) => [{ error: 2, respuesta: a.cifra }],
  termino_de_la_division: (a) => [{ error: 3, respuesta: a.sinResto }],
  distributiva_naturales: (a) => [{ error: 4, respuesta: a.soloPrimero }],
  recuento_multiplicativo: (a) => [{ error: 5, respuesta: a.sumando }],
  recuento_sin_orden: (a) => [{ error: 6, respuesta: a.contandoDosVeces }],
  problemas_de_resto: (a) => [{ error: 7, respuesta: a.otraLectura }],
  calculo_mental_trucos: (a) => [{ error: 8, respuesta: a.aMedias }],
};
