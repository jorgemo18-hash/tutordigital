// LAS RESPUESTAS-TRAMPA DEL TEMA FUNCIONES Y GRÁFICAS (migración 144). Mismo
// contrato que las demás (trampasDelApartado.js); los números son los de
// ESTE tema.
export const ERRORES_FUNCIONES = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000001101", categoria: "procedimiento", corto: "Escribe las coordenadas al revés, (y, x)" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000001102", categoria: "conceptual", corto: "Se equivoca de cuadrante" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000001103", categoria: "signo", corto: "Sustituye un negativo sin su signo" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000001104", categoria: "conceptual", corto: "Intercambia la parte fija y la que va por unidad" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000001105", categoria: "interpretacion", corto: "Compara solo la parte fija de dos tarifas" },
];

export const TRAMPAS_FUNCIONES = {
  lee_coordenadas: (a) => [{ error: 1, respuesta: a.alReves }],
  cuadrante: (a) => [{ error: 2, respuesta: a.alReves }],
  completa_tabla_funcion: (a) => [{ error: 3, respuesta: a.sinSigno }],
  tabla_a_expresion: (a) => [{ error: 4, respuesta: a.cambiada }],
  problemas_funcion_lineal: (a) => [{ error: 4, respuesta: a.cambiada }],
  grafica_a_expresion: (a) => [{ error: 4, respuesta: a.cambiada }],
  compara_tarifas: (a) => [{ error: 5, respuesta: a.soloLoFijo }],
};
