// LOS ERRORES PREDECIBLES DE ENTEROS (migración 120, `contenido_errores_tipo`).
//
// Son los 13 con `predecible = true`: los que producen una respuesta
// equivocada que se puede CALCULAR antes de que el alumno la escriba. Los
// otros dos (14 "signos bien, cálculo mal" y 15 "descuido") son el cajón de
// "está mal y no coincide con nada": no tienen respuesta-trampa, y así debe
// ser (ver el comentario de la migración 119).
//
// El `id` es el de la base de datos, para enlazar sin inventar nada; el
// `numero` es su `orden`, que es como se nombran en la tabla de revisión.
// Un test comprueba que los trece están en la migración 120 con este id,
// este orden y `predecible = true`.
export const ERRORES_PREDECIBLES = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000001", categoria: "conceptual", corto: "No ve el signo del número (lo confunde con el de la operación)" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000002", categoria: "conceptual", corto: "Suma los valores absolutos con signos distintos" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000003", categoria: "signo", corto: "Signo equivocado con signos distintos" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000004", categoria: "conceptual", corto: "Ordena los negativos por su valor absoluto" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000005", categoria: "procedimiento", corto: "Regla de los signos al revés (producto y cociente)" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000006", categoria: "conceptual", corto: "Restar siempre hace más pequeño" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000007", categoria: "procedimiento", corto: "Quita un paréntesis con menos delante sin cambiar los signos de dentro" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000008", categoria: "jerarquia", corto: "Opera de izquierda a derecha sin jerarquía" },
  { numero: 9, id: "c2000000-0000-4000-8000-000000000009", categoria: "interpretacion", corto: "Traduce el enunciado con el signo contrario" },
  { numero: 10, id: "c2000000-0000-4000-8000-000000000010", categoria: "conceptual", corto: "Aplica la regla de los signos a la suma" },
  { numero: 11, id: "c2000000-0000-4000-8000-000000000011", categoria: "conceptual", corto: "El valor absoluto es el propio número" },
  { numero: 12, id: "c2000000-0000-4000-8000-000000000012", categoria: "conceptual", corto: "El opuesto es el propio número" },
  { numero: 13, id: "c2000000-0000-4000-8000-000000000013", categoria: "conceptual", corto: "Cree que el cero es positivo o negativo" },
];

export const ERROR_POR_NUMERO = Object.fromEntries(ERRORES_PREDECIBLES.map((e) => [e.numero, e]));
