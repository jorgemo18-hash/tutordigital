import { reuneApartados } from "../../ejercicio.js";
import { euros } from "./numeros.js";

// PROPORCIONALIDAD, OBJETIVO 5: CONSUMO RESPONSABLE (concepto 8). Saber
// A.6, Educación financiera: «Métodos para la toma de decisiones de consumo
// responsable: relaciones calidad-precio y valor-precio en contextos
// cotidianos» e «Información numérica en contextos financieros sencillos:
// interpretación».
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR es el 11: elegir el paquete que
// cuesta MENOS EN TOTAL sin mirar cuánto trae. Por eso en "¿cuál sale más
// barato?" el paquete más barato en total es SIEMPRE el más caro por
// unidad: si coincidieran, el error no se distinguiría del acierto.

const PRODUCTOS = [
  { cosa: "Yogures", unidad: "yogur", medida: (n) => `${n} yogures` },
  { cosa: "Arroz", unidad: "kg", medida: (n) => `${n} kg` },
  { cosa: "Agua", unidad: "botella", medida: (n) => `${n} botellas` },
  { cosa: "Detergente", unidad: "litro", medida: (n) => `${n} litros` },
  { cosa: "Pilas", unidad: "pila", medida: (n) => `${n} pilas` },
  { cosa: "Lápices", unidad: "lápiz", medida: (n) => `${n} lápices` },
];

// ── "¿Qué paquete sale más barato?" (dificultad 2) ──────────────────────
export function mejorOferta(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(PRODUCTOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const prod = plan[i % plan.length];
    i += 1;
    // El paquete pequeño: menos unidades y más caro por unidad.
    const nPeq = azar.entero(2, 5);
    const nGra = nPeq + azar.entero(2, 6);
    const uGra = 5 * azar.entero(6, 40);
    const uPeq = uGra + 5 * azar.entero(1, 6);
    const totPeq = nPeq * uPeq;
    const totGra = nGra * uGra;
    if (totPeq >= totGra) return null;
    const grandeEsA = azar.suerte(0.5);
    const A = grandeEsA ? [nGra, totGra, uGra] : [nPeq, totPeq, uPeq];
    const B = grandeEsA ? [nPeq, totPeq, uPeq] : [nGra, totGra, uGra];
    const enunciado = `${prod.cosa}. A: ${prod.medida(A[0])} por ${euros(A[1])}. B: ${prod.medida(B[0])} por ${euros(B[1])}. ¿Cuál sale más barato por ${prod.unidad}?`;
    const bueno = grandeEsA ? "A" : "B";
    return {
      latex: `${enunciado} ___`,
      latexResuelto: `${enunciado} ${bueno}.`,
      texto: `${enunciado} ___`,
      solucion: bueno,
      producto: prod.cosa,
      precios: { A, B },
      masBaratoEnTotal: grandeEsA ? "B" : "A",
      razon: `Precio de 1 ${prod.unidad}: A, ${euros(A[1])} : ${A[0]} = ${euros(A[2])}; B, ${euros(B[1])} : ${B[0]} = ${euros(B[2])}. `
        + `Sale más barato ${bueno}, aunque en total cueste más.`,
    };
  }, { cuantos, clave: (a) => a.producto });

  return {
    clave: "mejor_oferta",
    arquetipo: "Compara dos paquetes por el precio de la unidad",
    enunciado: "Calcula el precio de una unidad en cada paquete y contesta A o B:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

const PROMOCIONES = [
  {
    id: "3x2",
    crea: (azar) => {
      const u = 10 * azar.entero(6, 30);
      const k = azar.entero(1, 3);
      return {
        enunciado: `Los botes de tomate cuestan ${euros(u)} y hay una oferta 3x2 (te llevas 3 y pagas 2). ¿Cuánto pagas por ${3 * k} botes?`,
        paga: 2 * k * u,
        razon: `De cada 3 botes se pagan 2: por ${3 * k} se pagan ${2 * k}. ${2 * k} · ${euros(u)} = ${euros(2 * k * u)}.`,
      };
    },
  },
  {
    id: "segunda_mitad",
    crea: (azar) => {
      const u = 200 * azar.entero(3, 15);
      return {
        enunciado: `Una camiseta cuesta ${euros(u)} y la segunda unidad sale a mitad de precio. ¿Cuánto pagas por dos camisetas?`,
        paga: u + u / 2,
        razon: `La primera, ${euros(u)}; la segunda, la mitad: ${euros(u / 2)}. En total, ${euros(u + u / 2)}.`,
      };
    },
  },
  {
    id: "segunda_70",
    crea: (azar) => {
      const u = 100 * azar.entero(2, 12);
      const segunda = (u * 30) / 100;
      return {
        enunciado: `Un champú cuesta ${euros(u)} y la segunda unidad tiene un 70 % de descuento. ¿Cuánto pagas por dos?`,
        paga: u + segunda,
        razon: `La segunda se paga al 30 %: ${euros(segunda)}. En total, ${euros(u)} + ${euros(segunda)} = ${euros(u + segunda)}.`,
      };
    },
  },
  {
    id: "4x3",
    crea: (azar) => {
      const u = 50 * azar.entero(2, 12);
      return {
        enunciado: `Unos cuadernos cuestan ${euros(u)} y hay una oferta 4x3. ¿Cuánto pagas por 8 cuadernos?`,
        paga: 6 * u,
        razon: `De cada 4 se pagan 3: por 8 se pagan 6. 6 · ${euros(u)} = ${euros(6 * u)}.`,
      };
    },
  },
  {
    id: "descuento_total",
    crea: (azar) => {
      const u = 100 * azar.entero(2, 15);
      const n = azar.entero(3, 6);
      const p = azar.elige([10, 20, 25]);
      const total = n * u;
      const paga = total - (total * p) / 100;
      return {
        enunciado: `Si compras ${n} botellas de aceite de ${euros(u)}, te hacen un ${p} % de descuento en el total. ¿Cuánto pagas?`,
        paga,
        razon: `Sin descuento, ${n} · ${euros(u)} = ${euros(total)}. Descuento: el ${p} % de ${euros(total)} = ${euros(total - paga)}. Pagas ${euros(paga)}.`,
      };
    },
  },
];

// ── "Ofertas: ¿cuánto pagas?" (dificultad 2) ────────────────────────────
// Leer lo que dice una promoción de verdad (3x2, segunda unidad a mitad de
// precio…) y convertirlo en una cuenta: la «información numérica en
// contextos financieros sencillos» de A.6.
export function promociones(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(PROMOCIONES);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    const p = ctx.crea(azar);
    if (!Number.isInteger(p.paga)) return null;
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${euros(p.paga)}.`,
      texto: `${p.enunciado} ___`,
      solucion: euros(p.paga),
      contexto: ctx.id,
      razon: p.razon,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "promociones",
    arquetipo: "Calcula lo que se paga con una oferta",
    enunciado: "Calcula lo que pagas:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
