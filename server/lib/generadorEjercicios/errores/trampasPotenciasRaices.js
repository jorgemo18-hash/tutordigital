import { potenciaTexto, superindice, mantisaTexto } from "../generadores/potenciasRaices/formato.js";

// LAS RESPUESTAS-TRAMPA DEL TEMA POTENCIAS Y RAÍCES (migración 136). Mismo
// contrato que las de enteros y divisibilidad (trampasDelApartado.js), y los
// números de error son los de ESTE tema (su `orden` en la 136).
export const ERRORES_POTENCIAS_RAICES = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000301", categoria: "conceptual", corto: "Multiplica la base por el exponente" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000302", categoria: "procedimiento", corto: "Multiplica los exponentes en el producto" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000303", categoria: "procedimiento", corto: "Multiplica también las bases en el producto" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000304", categoria: "procedimiento", corto: "Divide los exponentes en el cociente" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000305", categoria: "procedimiento", corto: "Suma los exponentes en la potencia de una potencia" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000306", categoria: "procedimiento", corto: "Exponente = número de cifras (notación científica)" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000307", categoria: "conceptual", corto: "La raíz cuadrada como la mitad" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000308", categoria: "procedimiento", corto: "Resto restando la raíz y no su cuadrado" },
];

export const TRAMPAS_POTENCIAS_RAICES = {
  calcula_potencia: (a) => [{ error: 1, respuesta: a.base * a.exponente }],
  compara_potencias: (a) => {
    const [[b1, e1], [b2, e2]] = a.pareja;
    const p = b1 * e1;
    const q = b2 * e2;
    return [{ error: 1, respuesta: p === q ? "=" : p < q ? "<" : ">" }];
  },
  producto_misma_base: (a) => [
    { error: 2, respuesta: potenciaTexto(a.base, a.m * a.n) },
    { error: 3, respuesta: potenciaTexto(a.base * a.base, a.m + a.n) },
  ],
  cociente_misma_base: (a) => (a.m % a.n === 0 ? [{ error: 4, respuesta: potenciaTexto(a.base, a.m / a.n) }] : []),
  potencia_de_potencia: (a) => [{ error: 5, respuesta: potenciaTexto(a.base, a.m + a.n) }],
  propiedades_mezcladas: (a) => (a.eConError5 >= 1 ? [{ error: 5, respuesta: potenciaTexto(a.base, a.eConError5) }] : []),
  // Con el error 6 el exponente es el número de cifras: uno más.
  notacion_cientifica: (a) => (a.sentido === "a_cientifica"
    ? [{ error: 6, respuesta: `${mantisaTexto(a.mantisa)} · 10${superindice(a.mantisa.e + 1)}` }]
    : []),
  raiz_exacta: (a) => (a.numero % 2 === 0 ? [{ error: 7, respuesta: a.numero / 2 }] : []),
  raiz_entera: (a) => [{ error: 8, respuesta: `${a.raiz}, resto ${a.numero - a.raiz}` }],
};
