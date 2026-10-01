import { reuneApartados } from "../../ejercicio.js";
import { coma, fraccion } from "./escritura.js";

// PROBABILIDAD, OBJETIVO 4 (conceptos 6, 7 y 8). Saber E.2: «Fenómenos
// deterministas y aleatorios: identificación» y «Asignación de
// probabilidades mediante experimentación, el concepto de frecuencia
// relativa y la regla de Laplace».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   8 Laplace con favorables entre DESFAVORABLES (3 rojas y 7 azules: 3/7);
//   9 Laplace entre el número de colores, no de bolas (3 colores: 1/3);
//  10 dar la frecuencia absoluta (las veces) en vez de la relativa.

const FENOMENOS = {
  aleatorio: [
    "Lanzar un dado y anotar el número que sale",
    "Lanzar una moneda al aire",
    "Sacar una carta de una baraja sin mirar",
    "El número que gana en la lotería",
    "Sacar sin mirar una bola de una bolsa con bolas de colores",
    "El color del primer coche que pase por la calle",
    "Girar una ruleta y ver dónde se para",
    "El número de llamadas que recibirás mañana",
  ],
  determinista: [
    "Soltar una piedra desde una ventana y ver si cae",
    "Calcular el área de un cuadrado de 3 cm de lado",
    "El día de la semana que será dentro de 7 días",
    "Multiplicar 7 por 8",
    "Lo que recorre en 2 horas un tren que va siempre a 100 km/h",
    "Echar aceite en agua y ver si flota",
    "Lo que pagas por 3 kg de patatas a 2 € el kilo",
    "Calentar un cubito de hielo y ver si se derrite",
  ],
};

// ── "¿Aleatorio o determinista?" (dificultad 1) ─────────────────────────
export function aleatorioODeterminista(azar, { cuantos = 6 } = {}) {
  const tipos = Object.keys(FENOMENOS);
  const plan = [
    // Primero, dos de cada (mezcladas entre sí); después, el resto.
    ...azar.mezcla(tipos.flatMap((t) => azar.mezcla(FENOMENOS[t]).slice(0, 2).map((f) => ({ f, t })))),
    ...azar.mezcla(tipos.flatMap((t) => FENOMENOS[t].map((f) => ({ f, t })))),
  ];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const x = plan[i];
    i += 1;
    if (!x) return null;
    return {
      latex: `${x.f}: ___`,
      latexResuelto: `${x.f}: ${x.t}`,
      texto: `${x.f}: ___`,
      solucion: x.t,
      razon: x.t === "aleatorio"
        ? `${x.f}: aunque se repita igual, no se sabe qué va a salir. Es aleatorio.`
        : `${x.f}: se sabe el resultado antes de hacerlo. Es determinista.`,
    };
  }, { cuantos, intentos: plan.length + 1, clave: (a) => a.texto });

  return {
    clave: "aleatorio_o_determinista",
    arquetipo: "Di si el experimento es aleatorio o determinista",
    enunciado: "Di si cada experimento es aleatorio o determinista:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// Las preguntas de Laplace: casos favorables, casos posibles y, si la
// pregunta es por un color de la bolsa, cuántos colores hay (error 9).
const DADO = [
  { suceso: "salga un número par", f: 3 },
  { suceso: "salga un múltiplo de 3", f: 2 },
  { suceso: "salga un número mayor que 4", f: 2 },
  { suceso: "salga un número primo", f: 3 },
  { suceso: "salga un número menor que 3", f: 2 },
  { suceso: "salga un 5", f: 1 },
];

const BARAJA = [
  { suceso: "sea de oros", f: 10 },
  { suceso: "sea un as", f: 4 },
  { suceso: "sea una figura (sota, caballo o rey)", f: 12 },
  { suceso: "sea el rey de copas", f: 1 },
  { suceso: "no sea de espadas", f: 30 },
];

const COLORES = ["rojas", "azules", "verdes", "amarillas"];
const singular = { rojas: "roja", azules: "azul", verdes: "verde", amarillas: "amarilla" };

const PREGUNTAS = [
  {
    id: "bolsa",
    crea: (azar) => {
      const k = azar.entero(2, 3);
      const colores = COLORES.slice(0, k);
      const cuantas = colores.map(() => azar.entero(2, 9));
      const n = cuantas.reduce((s, x) => s + x, 0);
      const j = azar.entero(0, k - 1);
      const contra = azar.suerte(0.3);
      const bolsa = colores.map((c, x) => `${cuantas[x]} ${c}`).join(", ").replace(/, ([^,]*)$/, " y $1");
      return {
        contexto: `En una bolsa hay ${bolsa}. Se saca una bola sin mirar. ¿Qué probabilidad hay de que ${contra ? "NO " : ""}sea ${singular[colores[j]]}?`,
        f: contra ? n - cuantas[j] : cuantas[j],
        n,
        colores: contra ? null : k,
        explica: `${contra ? `no ${singular[colores[j]]}: ${n} − ${cuantas[j]} = ${n - cuantas[j]}` : `${singular[colores[j]]}s: ${cuantas[j]}`} bolas de ${n}`,
      };
    },
  },
  {
    id: "dado",
    crea: (azar) => {
      const q = azar.elige(DADO);
      return { contexto: `Se lanza un dado de seis caras. ¿Qué probabilidad hay de que ${q.suceso}?`, f: q.f, n: 6, explica: `${q.f} caras de 6` };
    },
  },
  {
    id: "ruleta",
    crea: (azar) => {
      const n = azar.elige([8, 10, 12]);
      const k = azar.entero(3, n - 3);
      const q = azar.elige([
        { suceso: "un número par", f: Math.floor(n / 2) },
        { suceso: `un número mayor que ${k}`, f: n - k },
        { suceso: "un múltiplo de 4", f: Math.floor(n / 4) },
      ]);
      return { contexto: `Una ruleta tiene ${n} casillas iguales numeradas del 1 al ${n}. ¿Qué probabilidad hay de que salga ${q.suceso}?`, f: q.f, n, explica: `${q.f} casillas de ${n}` };
    },
  },
  {
    id: "baraja",
    crea: (azar) => {
      const q = azar.elige(BARAJA);
      return { contexto: `Se saca una carta de una baraja española de 40 cartas. ¿Qué probabilidad hay de que ${q.suceso}?`, f: q.f, n: 40, explica: `${q.f} cartas de 40` };
    },
  },
];

// ── "Calcula la probabilidad con la regla de Laplace" (dificultad 2) ────
export function probabilidadLaplace(azar, { cuantos = 4 } = {}) {
  const plan = azar.mezcla(PREGUNTAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const p = plan[i % plan.length];
    i += 1;
    const q = p.crea(azar);
    if (q.f <= 0 || q.f >= q.n) return null;
    const P = fraccion(q.f, q.n);
    return {
      latex: `${q.contexto} $P =$ ___`,
      latexResuelto: `${q.contexto} $P = ${P.latex}$`,
      texto: `${q.contexto} → P = ___`,
      solucion: P.texto,
      entreDesfavorables: fraccion(q.f, q.n - q.f).texto,
      entreColores: q.colores ? fraccion(1, q.colores).texto : null,
      contexto: p.id,
      razon: `Regla de Laplace: casos favorables entre casos posibles. Aquí, ${q.explica}: ${q.f}/${q.n}${P.texto !== `${q.f}/${q.n}` ? ` = ${P.texto}` : ""}.`,
    };
  }, { cuantos, intentos: 200, clave: (a) => a.texto });

  return {
    clave: "probabilidad_laplace",
    arquetipo: "Calcula la probabilidad con la regla de Laplace",
    enunciado: "Calcula la probabilidad (como fracción irreducible):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

const EXPERIMENTOS = [
  {
    id: "dado",
    crea: (azar) => {
      const n = azar.elige([300, 600, 1200]);
      const justo = azar.suerte();
      const k = justo ? n / 6 + azar.entero(-n / 60, n / 60) : azar.elige([n / 3, n / 2, (2 * n) / 5]);
      return {
        frase: `Se lanza un dado ${n} veces y el 6 sale ${k} veces. ¿Cuál es la frecuencia relativa del 6 (con dos decimales)? Con un dado normal, la probabilidad es 1/6 ≈ 0,17: ¿parece un dado normal?`,
        k, n, segunda: justo ? "sí" : "no",
        explica2: justo ? "está muy cerca de 0,17: parece normal" : "está muy lejos de 0,17: parece trucado",
      };
    },
  },
  {
    id: "chincheta",
    crea: (azar) => {
      const n = azar.elige([100, 200, 400]);
      const k = (n / 100) * azar.entero(55, 75);
      return {
        frase: `Se lanza una chincheta ${n} veces y cae con la punta hacia arriba ${k} veces. ¿Cuál es la frecuencia relativa de «punta hacia arriba» (con dos decimales)? ¿Qué probabilidad le darías a que caiga de lado?`,
        k, n, segunda: coma(1 - k / n),
        explica2: `la otra posibilidad es lo que falta hasta 1: 1 − ${coma(k / n)} = ${coma(1 - k / n)}`,
      };
    },
  },
  {
    id: "tiros",
    crea: (azar) => {
      const n = azar.elige([50, 100, 200]);
      const k = (n / 100) * azar.entero(40, 80);
      if (!Number.isInteger(k)) return null;
      return {
        frase: `Una jugadora ha lanzado ${n} tiros libres y ha encestado ${k}. ¿Cuál es la frecuencia relativa de encestar (con dos decimales)? ¿Qué probabilidad le darías a que falle el próximo?`,
        k, n, segunda: coma(1 - k / n),
        explica2: `fallar es lo que falta hasta 1: 1 − ${coma(k / n)} = ${coma(1 - k / n)}`,
      };
    },
  },
];

// ── "Frecuencia relativa de un experimento" (dificultad 3) ──────────────
export function frecuenciaRelativa(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(EXPERIMENTOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const e = plan[i % plan.length];
    i += 1;
    const x = e.crea(azar);
    if (!x) return null;
    const fr = coma(x.k / x.n);
    return {
      latex: `${x.frase} ___; ___`,
      latexResuelto: `${x.frase} ${fr}; ${x.segunda}`,
      texto: `${x.frase} → ___; ___`,
      solucion: [fr, x.segunda],
      absoluta: [String(x.k), x.segunda],
      contexto: e.id,
      razon: `Frecuencia relativa = veces que sale entre veces que se hace: ${x.k} : ${x.n} = ${fr}. Con muchas repeticiones se acerca a la probabilidad: ${x.explica2}.`,
    };
  }, { cuantos, intentos: 200, clave: (a) => a.contexto });

  return {
    clave: "frecuencia_relativa",
    arquetipo: "Calcula la frecuencia relativa de un experimento y úsala",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
