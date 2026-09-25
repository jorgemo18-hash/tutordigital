// LAS RESPUESTAS-TRAMPA DEL TEMA GEOMETRÍA (migración 143). Mismo contrato
// que las demás (trampasDelApartado.js); los números son los de ESTE tema.
export const ERRORES_GEOMETRIA = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000001001", categoria: "conceptual", corto: "Confunde perímetro y área" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000001002", categoria: "procedimiento", corto: "Olvida dividir entre 2" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000001003", categoria: "conceptual", corto: "Usa el lado inclinado como altura" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000001004", categoria: "interpretacion", corto: "Usa el diámetro como radio" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000001005", categoria: "procedimiento", corto: "Calcula r² como r · 2" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000001006", categoria: "conceptual", corto: "Confunde complementario y suplementario" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000001007", categoria: "conceptual", corto: "Los ángulos del triángulo suman 360°" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000001008", categoria: "procedimiento", corto: "Multiplica las medidas de fuera de la figura compuesta" },
];

export const TRAMPAS_GEOMETRIA = {
  perimetro_y_area: (a) => [{ error: 1, respuesta: a.cambiados }],
  area_triangulo: (a) => [{ error: 2, respuesta: a.sinMitad }, { error: 3, respuesta: a.conElLado }],
  area_cuadrilateros: (a) => [{ error: 2, respuesta: a.sinMitad }, { error: 3, respuesta: a.conElLado }],
  longitud_circunferencia: (a) => [{ error: 4, respuesta: a.diametroComoRadio }],
  area_circulo: (a) => [{ error: 4, respuesta: a.diametroComoRadio }, { error: 5, respuesta: a.r2ComoDoble }],
  complementario_suplementario: (a) => [{ error: 6, respuesta: a.confundido }],
  angulo_del_triangulo: (a) => [{ error: 7, respuesta: `${360 - a.a - a.b}°` }],
  figura_compuesta: (a) => [{ error: 8, respuesta: a.exterior }],
};
