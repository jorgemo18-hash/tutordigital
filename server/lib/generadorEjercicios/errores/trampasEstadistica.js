// LAS RESPUESTAS-TRAMPA DEL TEMA ESTADÍSTICA Y PROBABILIDAD (migración 150).
// Mismo contrato que las demás (trampasDelApartado.js); los números son los
// de ESTE tema.
export const ERRORES_ESTADISTICA = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000001201", categoria: "conceptual", corto: "Confunde cuantitativa discreta y continua" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000001202", categoria: "conceptual", corto: "Escribe la frecuencia absoluta como porcentaje" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000001203", categoria: "conceptual", corto: "Da como moda la frecuencia, no el valor" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000001204", categoria: "procedimiento", corto: "Toma el porcentaje por el ángulo del sector" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000001205", categoria: "procedimiento", corto: "Busca la mediana sin ordenar los datos" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000001206", categoria: "procedimiento", corto: "Hace la media de una tabla sin las frecuencias" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000001207", categoria: "interpretacion", corto: "Cree más regular al de mayor rango" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000001208", categoria: "conceptual", corto: "Laplace: favorables entre desfavorables" },
  { numero: 9, id: "c2000000-0000-4000-8000-000000001209", categoria: "conceptual", corto: "Laplace: divide entre los colores, no entre las bolas" },
  { numero: 10, id: "c2000000-0000-4000-8000-000000001210", categoria: "conceptual", corto: "Da la frecuencia absoluta en vez de la relativa" },
];

export const TRAMPAS_ESTADISTICA = {
  tipo_de_variable: (a) => [{ error: 1, respuesta: a.cambiada }],
  tabla_de_frecuencias: (a) => [{ error: 2, respuesta: a.porcentajeComoFrecuencia }],
  lee_diagrama_barras: (a) => [{ error: 3, respuesta: a.modaComoFrecuencia }],
  angulos_de_sectores: (a) => [{ error: 4, respuesta: a.porcentajeComoAngulo }],
  media_mediana_moda: (a) => [{ error: 5, respuesta: a.sinOrdenar }, { error: 3, respuesta: a.modaComoFrecuencia }],
  media_de_tabla: (a) => [{ error: 6, respuesta: a.sinFrecuencias }],
  compara_conjuntos: (a) => [{ error: 7, respuesta: a.alReves }],
  probabilidad_laplace: (a) => [{ error: 8, respuesta: a.entreDesfavorables }, { error: 9, respuesta: a.entreColores }],
  frecuencia_relativa: (a) => [{ error: 10, respuesta: a.absoluta }],
};
