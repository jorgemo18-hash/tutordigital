// LAS RESPUESTAS-TRAMPA DEL TEMA NÚMEROS DECIMALES (migración 140). Mismo
// contrato que las demás (trampasDelApartado.js); los números son los de
// ESTE tema.
export const ERRORES_DECIMALES = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000701", categoria: "conceptual", corto: "Más cifras decimales, más grande" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000702", categoria: "conceptual", corto: "Confunde las posiciones decimales" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000703", categoria: "procedimiento", corto: "Redondea cortando" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000704", categoria: "procedimiento", corto: "Alinea a la derecha y no por la coma" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000705", categoria: "procedimiento", corto: "Al restar a un entero, baja los decimales" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000706", categoria: "procedimiento", corto: "Pone los decimales de un solo factor" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000707", categoria: "procedimiento", corto: "Por 10 añade ceros; entre 10, mueve la coma al revés" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000708", categoria: "procedimiento", corto: "Divide entre un decimal sin mover la coma del dividendo" },
  { numero: 9, id: "c2000000-0000-4000-8000-000000000709", categoria: "conceptual", corto: "Multiplicar siempre agranda; dividir, achica" },
  { numero: 10, id: "c2000000-0000-4000-8000-000000000710", categoria: "conceptual", corto: "3/4 = 3,4" },
];

export const TRAMPAS_DECIMALES = {
  valor_posicional_decimal: (a) => [{ error: 2, respuesta: a.vecina }],
  escribe_decimal_con_cifras: (a) => [{ error: 2, respuesta: a.sinCeros }],
  fraccion_a_decimal: (a) => [{ error: 10, respuesta: a.comaEnMedio }, { error: 2, respuesta: a.sinCeros }],
  compara_decimales: (a) => [{ error: 1, respuesta: a.conError1 }],
  ordena_decimales: (a) => [{ error: 1, respuesta: a.conError1 }],
  redondea_decimal: (a) => [{ error: 3, respuesta: a.cortado }],
  suma_decimales: (a) => [{ error: 4, respuesta: a.alineado }],
  resta_decimales: (a) => [{ error: 4, respuesta: a.alineado }, { error: 5, respuesta: a.bajando }],
  por_potencia_de_diez: (a) => [{ error: 7, respuesta: a.comaMal }],
  multiplica_decimales: (a) => [{ error: 6, respuesta: a.decimalesDeUno }],
  divide_decimales: (a) => [{ error: 8, respuesta: a.sinMoverDividendo }],
  efecto_de_operar: (a) => [{ error: 9, respuesta: a.siempre }],
};
