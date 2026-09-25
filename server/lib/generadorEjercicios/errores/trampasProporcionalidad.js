import { conComa } from "../generadores/proporcionalidad/numeros.js";

// LAS RESPUESTAS-TRAMPA DEL TEMA PROPORCIONALIDAD Y PORCENTAJES (migración
// 139). Mismo contrato que las demás (trampasDelApartado.js); los números
// son los de ESTE tema.
export const ERRORES_PROPORCIONALIDAD = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000601", categoria: "interpretacion", corto: "Escribe la razón al revés" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000602", categoria: "conceptual", corto: "Razona sumando en vez de multiplicando" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000603", categoria: "procedimiento", corto: "Multiplica sin pasar por la unidad" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000604", categoria: "procedimiento", corto: "Calcula el porcentaje dividiendo entre él" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000605", categoria: "conceptual", corto: "Pasa el % a decimal moviendo la coma un lugar" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000606", categoria: "procedimiento", corto: "Se queda en el cociente sin pasarlo a %" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000607", categoria: "interpretacion", corto: "Calcula el porcentaje de la parte, no el total" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000608", categoria: "interpretacion", corto: "Contesta el descuento en vez de lo que se paga" },
  { numero: 9, id: "c2000000-0000-4000-8000-000000000609", categoria: "conceptual", corto: "Suma el porcentaje como si fueran euros" },
  { numero: 10, id: "c2000000-0000-4000-8000-000000000610", categoria: "conceptual", corto: "Aplica el porcentaje al precio de después" },
  { numero: 11, id: "c2000000-0000-4000-8000-000000000611", categoria: "interpretacion", corto: "Elige el paquete más barato en total" },
];

const aditivaUna = (a) => (a.aditiva ? "sí" : null);

export const TRAMPAS_PROPORCIONALIDAD = {
  razon_simplificada: (a) => [{ error: 1, respuesta: `${a.alReves.n}/${a.alReves.d}` }],
  es_proporcion: (a) => [{ error: 2, respuesta: aditivaUna(a) }],
  son_proporcionales: (a) => [{ error: 2, respuesta: aditivaUna(a) }],
  termino_de_proporcion: (a) => [{ error: 2, respuesta: a.aditiva }],
  completa_tabla_proporcional: (a) => [{ error: 2, respuesta: a.aditiva }],
  problemas_reduccion_unidad: (a) => [{ error: 3, respuesta: a.sinUnidad }],
  porcentaje_fraccion_decimal: (a) => [{ error: 5, respuesta: [a.solucion[0], conComa(a.p / 10)] }],
  porcentaje_de_cantidad: (a) => [{ error: 4, respuesta: Number.isInteger(a.q / a.p) ? a.q / a.p : null }],
  que_porcentaje_es: (a) => [{ error: 6, respuesta: a.soloCociente }],
  total_desde_porcentaje: (a) => [{ error: 7, respuesta: a.deLaParte }],
  rebaja_precio_final: (a) => [{ error: 8, respuesta: a.soloDescuento }],
  subida_e_impuestos: (a) => [{ error: 9, respuesta: a.comoEuros }],
  precio_antes: (a) => [{ error: 10, respuesta: a.conError10 }],
  mejor_oferta: (a) => [{ error: 11, respuesta: a.masBaratoEnTotal }],
};
