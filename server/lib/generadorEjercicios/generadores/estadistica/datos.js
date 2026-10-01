import { reuneApartados } from "../../ejercicio.js";
import { tablaDeFilas, HUECO_TABLA, lista } from "./escritura.js";
import { reparto } from "./calculos.js";

// ESTADÍSTICA, OBJETIVO 1: ORGANIZAR DATOS (conceptos 1 y 2). Saber E.1:
// «Estrategias de recogida y organización de datos… que involucran una sola
// variable» y «… variables cualitativas, cuantitativas discretas y
// cuantitativas continuas…».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 confundir cuantitativa discreta y continua (la estatura «se cuenta»);
//   2 escribir la frecuencia absoluta como porcentaje (con 20 datos, un
//     valor que sale 4 veces es el 20 %, no el 4 %).

const VARIABLES = {
  "cualitativa": [
    "Color de ojos", "Deporte favorito", "Marca de móvil", "Asignatura preferida",
    "Medio de transporte para ir al instituto", "Sabor de helado preferido", "Género de película favorito", "Mes de nacimiento",
  ],
  "cuantitativa discreta": [
    "Número de hermanos", "Número de mascotas en casa", "Goles marcados en un partido", "Libros leídos en un año",
    "Número de veces que vas al cine en un mes", "Alumnos de cada clase del instituto", "Número de pie", "Hijos de cada familia",
  ],
  "cuantitativa continua": [
    "Estatura", "Peso de la mochila", "Tiempo que tardas en llegar al instituto", "Temperatura máxima del día",
    "Litros de agua que bebes al día", "Longitud de un salto", "Distancia de casa al instituto", "Velocidad de un coche",
  ],
};

const RAZON_DEL_TIPO = {
  "cualitativa": "no es un número: es una cualidad",
  "cuantitativa discreta": "es un número que se cuenta (0, 1, 2…): no hay valores intermedios",
  "cuantitativa continua": "es una medida: entre dos valores siempre cabe otro (1,6; 1,65; 1,7…)",
};

const CAMBIADA = { "cuantitativa discreta": "cuantitativa continua", "cuantitativa continua": "cuantitativa discreta" };

// ── "Di de qué tipo es cada variable" (dificultad 1) ────────────────────
// Al menos dos de cada tipo, mezcladas: con una sola continua, el error 1
// casi no se puede ver.
export function tipoDeVariable(azar, { cuantos = 8 } = {}) {
  const tipos = Object.keys(VARIABLES);
  const plan = [
    // Primero, dos de cada (mezcladas entre sí); después, el resto.
    ...azar.mezcla(tipos.flatMap((t) => azar.mezcla(VARIABLES[t]).slice(0, 2).map((nombre) => ({ nombre, tipo: t })))),
    ...azar.mezcla(tipos.flatMap((t) => VARIABLES[t].map((nombre) => ({ nombre, tipo: t })))),
  ];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const v = plan[i];
    i += 1;
    if (!v) return null;
    return {
      latex: `${v.nombre}: ___`,
      latexResuelto: `${v.nombre}: ${v.tipo}`,
      texto: `${v.nombre}: ___`,
      solucion: v.tipo,
      cambiada: CAMBIADA[v.tipo] || null,
      razon: `${v.nombre}: ${RAZON_DEL_TIPO[v.tipo]}. Es ${v.tipo}.`,
    };
  }, { cuantos, intentos: plan.length + 1, clave: (a) => a.texto });

  return {
    clave: "tipo_de_variable",
    arquetipo: "Di de qué tipo es cada variable estadística",
    enunciado: "Di si cada variable es cualitativa, cuantitativa discreta o cuantitativa continua:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// Las situaciones de los datos: una variable que se cuenta, con valores
// pequeños, y 20 o 25 personas (así los porcentajes salen enteros).
const SITUACIONES = [
  { id: "hermanos", frase: "Número de hermanos de", valores: [0, 1, 2, 3] },
  { id: "mascotas", frase: "Número de mascotas en casa de", valores: [0, 1, 2, 3] },
  { id: "libros", frase: "Libros leídos este verano por", valores: [1, 2, 3, 4, 5] },
  { id: "cine", frase: "Veces que han ido al cine este mes", valores: [0, 1, 2, 3, 4] },
  { id: "goles", frase: "Goles marcados por un equipo en cada uno de", valores: [0, 1, 2, 3, 4] },
];

// ── "Haz la tabla de frecuencias" (dificultad 2) ────────────────────────
export function tablaDeFrecuencias(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(SITUACIONES);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const s = plan[i];
    i += 1;
    if (!s) return null;
    const n = azar.elige([20, 25]);
    const f = reparto(azar, n, s.valores.length);
    if (!f) return null;
    const datos = azar.mezcla(s.valores.flatMap((v, j) => Array(f[j]).fill(v)));
    const pct = f.map((x) => (x * 100) / n);
    const quien = s.id === "goles" ? `${n} partidos` : `${n} alumnos`;
    const frase = `${s.frase} ${quien}: ${lista(datos)}.`;
    const vacia = tablaDeFilas([["Valor", s.valores], ["Frec. absoluta", s.valores.map(() => HUECO_TABLA)], ["Porcentaje", s.valores.map(() => HUECO_TABLA)]]);
    const llena = tablaDeFilas([["Valor", s.valores], ["Frec. absoluta", f], ["Porcentaje", pct.map((p) => `${p}\\,\\%`)]]);
    const solucion = [f.join(", "), pct.map((p) => `${p} %`).join(", ")];
    return {
      latex: `${frase} $${vacia}$`,
      latexResuelto: `${frase} $${llena}$`,
      texto: `${frase} → valores ${s.valores.join(", ")}: frecuencias ___; porcentajes ___`,
      solucion,
      datos,
      valores: s.valores,
      porcentajeComoFrecuencia: [f.join(", "), f.map((x) => `${x} %`).join(", ")],
      contexto: s.id,
      razon: `Se cuenta cuántas veces sale cada valor: ${s.valores.map((v, j) => `${v} → ${f[j]}`).join("; ")} (suman ${n}). El porcentaje es la frecuencia entre ${n} por 100: ${f[0]} : ${n} · 100 = ${pct[0]} %.`,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "tabla_de_frecuencias",
    arquetipo: "Haz la tabla de frecuencias absolutas y porcentajes",
    enunciado: "Cuenta los datos y completa la tabla:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
