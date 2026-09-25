// LAS RESPUESTAS-TRAMPA DEL TEMA SISTEMA MÉTRICO DECIMAL (migración 142).
// Mismo contrato que las demás (trampasDelApartado.js); los números son los
// de ESTE tema.
export const ERRORES_MEDIDA = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000901", categoria: "procedimiento", corto: "Mueve la coma al revés" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000902", categoria: "procedimiento", corto: "Cuenta mal los escalones" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000903", categoria: "conceptual", corto: "En superficie, un lugar por escalón" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000904", categoria: "conceptual", corto: "Suma medidas sin pasarlas a la misma unidad" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000905", categoria: "conceptual", corto: "Compara los números sin mirar la unidad" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000906", categoria: "procedimiento", corto: "Junta las cifras de la forma compleja" },
];

export const TRAMPAS_MEDIDA = {
  cambio_de_unidad: (a) => [{ error: 1, respuesta: a.alReves }, { error: 2, respuesta: a.escalonDeMenos }],
  cambio_de_superficie: (a) => [{ error: 3, respuesta: a.comoLongitud }, { error: 1, respuesta: a.alReves }],
  suma_de_medidas: (a) => [{ error: 4, respuesta: a.sinPasar }],
  compara_medidas: (a) => [{ error: 5, respuesta: a.soloNumeros }],
  a_forma_incompleja: (a) => [{ error: 6, respuesta: a.juntando }],
};
