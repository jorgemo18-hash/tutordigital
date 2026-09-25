import { reuneApartados } from "../../ejercicio.js";
import { dec, texto, cociente, producto, resta, compara } from "./decimal.js";
import { euros } from "../proporcionalidad/numeros.js";

// DECIMALES, OBJETIVO 5: PROBLEMAS (concepto 8). Saber A.3: «Operaciones
// con … decimales en situaciones contextualizadas».
//
// PLANTILLAS ESCRITAS A MANO y datos que salen de la solución, como en los
// demás temas. El dinero en céntimos (proporcionalidad/numeros.js); las
// medidas, con decimal.js. Dos baterías con contextos distintos: una de
// sumar, restar y multiplicar (compras y medidas) y otra de dividir
// (repartos y "cuántos caben").

const COMPRAS = [
  {
    id: "vuelta",
    crea: (azar) => {
      const precios = [azar.entero(8, 45) * 10, azar.entero(12, 60) * 5, azar.entero(3, 20) * 25];
      const total = precios.reduce((s, p) => s + p, 0);
      // El billete más pequeño que llega (no existen los de 15 €).
      const paga = [500, 1000, 2000, 5000].find((b) => b > total);
      return {
        enunciado: `Compras un zumo de ${euros(precios[0])}, un bocadillo de ${euros(precios[1])} y una fruta de ${euros(precios[2])}. Pagas con un billete de ${euros(paga)}. ¿Cuánto te devuelven?`,
        solucion: euros(paga - total),
        razon: `Total: ${precios.map(euros).join(" + ")} = ${euros(total)}. Vuelta: ${euros(paga)} − ${euros(total)} = ${euros(paga - total)}.`,
      };
    },
  },
  {
    id: "por_kilo",
    crea: (azar) => {
      const precioKg = azar.entero(12, 48) * 10;
      const kg = dec(azar.entero(3, 9) * 5, 1);
      if (kg.e === 0) return null;
      const centimos = producto(dec(precioKg), kg);
      if (centimos.e > 0) return null;
      return {
        enunciado: `Las manzanas cuestan ${euros(precioKg)} el kilo. ¿Cuánto cuestan ${texto(kg)} kg?`,
        solucion: euros(centimos.n),
        razon: `${texto(kg)} · ${euros(precioKg)} = ${euros(centimos.n)}.`,
      };
    },
  },
  {
    id: "salto",
    crea: (azar) => {
      const a = dec(azar.entero(250, 480), 2);
      const b = dec(azar.entero(250, 480), 2);
      if (a.n === b.n) return null;
      // Se compara y se resta con decimal.js: `dec` ya ha quitado los ceros
      // (2,90 es { 29, 1 }), así que los `n` no están en las mismas unidades.
      const [mas, menos] = compara(a, b) > 0 ? [a, b] : [b, a];
      const dif = resta(mas, menos);
      return {
        enunciado: `En salto de longitud, Irene salta ${texto(mas)} m y Nora ${texto(menos)} m. ¿Cuántos metros más salta Irene?`,
        solucion: `${texto(dif)} m`,
        razon: `Coma debajo de coma: ${texto(mas, 2)} − ${texto(menos, 2)} = ${texto(dif)} m.`,
      };
    },
  },
  {
    id: "cuerdas",
    crea: (azar) => {
      const trozos = [dec(azar.entero(12, 35), 1), dec(azar.entero(105, 290), 2), dec(azar.entero(2, 6))];
      if (trozos.some((t, j) => j < 2 && t.e === 0)) return null;
      const total = trozos.reduce((s, t) => s + t.n * 10 ** (2 - t.e), 0);
      return {
        enunciado: `Para un móvil de clase se atan tres cuerdas de ${trozos.map((t) => `${texto(t)} m`).join(", ").replace(/, ([^,]*)$/, " y $1")}. ¿Cuántos metros de cuerda son?`,
        solucion: `${texto(dec(total, 2))} m`,
        razon: `Coma debajo de coma: ${trozos.map((t) => texto(t, 2)).join(" + ")} = ${texto(dec(total, 2))} m.`,
      };
    },
  },
  {
    id: "gasolina",
    crea: (azar) => {
      const litros = azar.entero(20, 45);
      const precio = azar.entero(140, 175);
      return {
        enunciado: `El litro de gasolina cuesta ${euros(precio)}. ¿Cuánto cuesta llenar un depósito de ${litros} litros?`,
        solucion: euros(litros * precio),
        razon: `${litros} · ${euros(precio)} = ${euros(litros * precio)}.`,
      };
    },
  },
];

const REPARTOS = [
  {
    id: "pizza",
    crea: (azar) => {
      const n = azar.entero(3, 6);
      const cada = azar.entero(180, 520) * 5;
      if (cada % 100 === 0) return null;
      return {
        enunciado: `${n} amigos pagan a partes iguales una cena de ${euros(n * cada)}. ¿Cuánto paga cada uno?`,
        solucion: euros(cada),
        razon: `${euros(n * cada)} : ${n} = ${euros(cada)}.`,
      };
    },
  },
  {
    id: "botella",
    crea: (azar) => {
      const [vaso, botella] = azar.elige([[dec(25, 2), dec(15, 1)], [dec(2, 1), dec(16, 1)], [dec(25, 2), dec(2)], [dec(3, 1), dec(18, 1)], [dec(2, 1), dec(3)]]);
      const cuantos = cociente(botella, vaso);
      return {
        enunciado: `¿Cuántos vasos de ${texto(vaso)} litros se llenan con una botella de ${texto(botella)} litros?`,
        solucion: texto(cuantos),
        razon: `${texto(botella)} : ${texto(vaso)}: se multiplican los dos por ${10 ** vaso.e} y queda ${texto(producto(botella, dec(10 ** vaso.e)))} : ${vaso.n} = ${texto(cuantos)} vasos.`,
      };
    },
  },
  {
    id: "etapas",
    crea: (azar) => {
      const n = azar.entero(3, 5);
      const cada = dec(azar.entero(125, 350), 1);
      if (cada.e === 0) return null;
      const total = producto(cada, dec(n));
      return {
        enunciado: `Una ruta en bici de ${texto(total)} km se hace en ${n} etapas iguales. ¿Cuántos km tiene cada etapa?`,
        solucion: `${texto(cada)} km`,
        razon: `${texto(total)} : ${n} = ${texto(cada)} km.`,
      };
    },
  },
  {
    id: "cinta",
    crea: (azar) => {
      const trozo = azar.elige([dec(25, 2), dec(5, 1), dec(4, 1), dec(15, 1)]);
      const n = azar.entero(6, 24);
      const total = producto(trozo, dec(n));
      return {
        enunciado: `Una cinta de ${texto(total)} m se corta en trozos de ${texto(trozo)} m. ¿Cuántos trozos salen?`,
        solucion: String(n),
        razon: `${texto(total)} : ${texto(trozo)}: se multiplican los dos por ${10 ** trozo.e}, ${texto(producto(total, dec(10 ** trozo.e)))} : ${trozo.n} = ${n} trozos.`,
      };
    },
  },
  {
    id: "precio_unidad",
    crea: (azar) => {
      const n = azar.elige([4, 5, 8, 10]);
      const cada = azar.entero(12, 95) * 5;
      return {
        enunciado: `Un paquete de ${n} rotuladores cuesta ${euros(n * cada)}. ¿Cuánto cuesta cada rotulador?`,
        solucion: euros(cada),
        razon: `${euros(n * cada)} : ${n} = ${euros(cada)}.`,
      };
    },
  },
];

function bateria(azar, cuantos, contextos) {
  const plan = azar.mezcla(contextos);
  let i = 0;
  return reuneApartados(() => {
    const ctx = plan[i];
    if (!ctx) return null;
    const p = ctx.crea(azar);
    if (!p) return null;
    i += 1;
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${p.solucion}.`,
      texto: `${p.enunciado} ___`,
      solucion: p.solucion,
      contexto: ctx.id,
      razon: p.razon,
    };
  }, { cuantos, clave: (a) => a.contexto }).apartados;
}

// ── "Compras y medidas" (dificultad 2) ──────────────────────────────────
export function problemasCompras(azar, { cuantos = 3 } = {}) {
  return {
    clave: "problemas_decimales_compras",
    arquetipo: "Resuelve problemas de compras y medidas con decimales",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados: bateria(azar, cuantos, COMPRAS),
  };
}

// ── "Repartos" (dificultad 3) ───────────────────────────────────────────
export function problemasRepartos(azar, { cuantos = 3 } = {}) {
  return {
    clave: "problemas_decimales_repartos",
    arquetipo: "Resuelve problemas de repartos con decimales",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados: bateria(azar, cuantos, REPARTOS),
  };
}
