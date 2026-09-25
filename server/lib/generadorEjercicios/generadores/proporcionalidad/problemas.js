import { reuneApartados } from "../../ejercicio.js";
import { euros, conComa, cantidadDeDinero } from "./numeros.js";
import { milesTexto } from "../potenciasRaices/formato.js";

// PROPORCIONALIDAD, OBJETIVO 2 (segunda mitad): PROBLEMAS DE
// PROPORCIONALIDAD DIRECTA (concepto 4). Saber A.5: «Situaciones de
// proporcionalidad en diferentes contextos: análisis y desarrollo de
// métodos para la resolución de problemas (… escalas, cambio de divisas,
// velocidad y tiempo, etc.)».
//
// EL MÉTODO DEL EJEMPLO ES LA REDUCCIÓN A LA UNIDAD ("primero lo que
// corresponde a 1"): el currículo no nombra la regla de tres, y la
// reducción a la unidad es la que se entiende sin memorizar una
// disposición. Como en álgebra, el otro método da los mismos ejercicios y
// solo cambiaría la explicación.
//
// PLANTILLAS ESCRITAS A MANO, y los datos salen de la solución: primero el
// valor de la unidad, después las cantidades. Las dos baterías tienen
// contextos distintos, para que una hoja no repita situación.
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR la reducción a la unidad es el 3:
// multiplicar el dato por la cantidad nueva sin pasar por la unidad
// ("3 kg cuestan 12 €; 5 kg: 12 · 5 = 60 €").

// Dos cantidades distintas de 2 a 12, la segunda nunca múltiplo de la
// primera (si lo fuera, "el doble" se ve sin pensar en la unidad).
function dosCantidades(azar) {
  const n1 = azar.entero(2, 8);
  const n2 = azar.entero(2, 12);
  if (n1 === n2 || n2 % n1 === 0) return null;
  return [n1, n2];
}

const UNIDAD = [
  {
    id: "cuadernos",
    crea: (azar, [n1, n2]) => {
      const u = 5 * azar.entero(16, 60);
      return {
        enunciado: `${n1} cuadernos iguales cuestan ${euros(n1 * u)}. ¿Cuánto cuestan ${n2} cuadernos?`,
        uno: `1 cuaderno cuesta ${euros(n1 * u)} : ${n1} = ${euros(u)}`,
        solucion: euros(n2 * u), cuenta: `${n2} · ${euros(u)} = ${euros(n2 * u)}`,
        sinUnidad: euros(n1 * u * n2),
      };
    },
  },
  {
    id: "grifo",
    crea: (azar, [n1, n2]) => {
      const u = azar.entero(3, 15);
      return {
        enunciado: `Un grifo echa ${n1 * u} litros en ${n1} minutos. ¿Cuántos litros echa en ${n2} minutos?`,
        uno: `en 1 minuto, ${n1 * u} : ${n1} = ${u} litros`,
        solucion: `${n2 * u} litros`, cuenta: `${n2} · ${u} = ${n2 * u} litros`,
        sinUnidad: `${n1 * u * n2} litros`,
      };
    },
  },
  {
    id: "entradas",
    crea: (azar, [n1, n2]) => {
      const u = 50 * azar.entero(8, 20);
      return {
        enunciado: `Por ${n1} entradas de cine se pagan ${euros(n1 * u)}. ¿Cuánto se paga por ${n2} entradas?`,
        uno: `1 entrada cuesta ${euros(n1 * u)} : ${n1} = ${euros(u)}`,
        solucion: euros(n2 * u), cuenta: `${n2} · ${euros(u)} = ${euros(n2 * u)}`,
        sinUnidad: euros(n1 * u * n2),
      };
    },
  },
  {
    id: "impresora",
    crea: (azar, [n1, n2]) => {
      const u = azar.entero(8, 30);
      return {
        enunciado: `Una impresora imprime ${n1 * u} hojas en ${n1} minutos. ¿Cuántas imprime en ${n2} minutos?`,
        uno: `en 1 minuto, ${n1 * u} : ${n1} = ${u} hojas`,
        solucion: `${n2 * u} hojas`, cuenta: `${n2} · ${u} = ${n2 * u} hojas`,
        sinUnidad: `${n1 * u * n2} hojas`,
      };
    },
  },
  {
    id: "fruta",
    crea: (azar, [n1, n2]) => {
      const u = 10 * azar.entero(12, 45);
      return {
        enunciado: `${n1} kg de naranjas cuestan ${euros(n1 * u)}. ¿Cuánto cuestan ${n2} kg?`,
        uno: `1 kg cuesta ${euros(n1 * u)} : ${n1} = ${euros(u)}`,
        solucion: euros(n2 * u), cuenta: `${n2} · ${euros(u)} = ${euros(n2 * u)}`,
        sinUnidad: euros(n1 * u * n2),
      };
    },
  },
];

// Escalas de mapa con las que 1 cm es un número redondo de km.
const ESCALAS = [
  { e: 100000, km: (c) => c, paso: 1 },
  { e: 50000, km: (c) => c / 2, paso: 2 },
  { e: 200000, km: (c) => 2 * c, paso: 1 },
  { e: 25000, km: (c) => c / 4, paso: 4 },
];

const CONTEXTOS = [
  {
    id: "escala",
    crea: (azar) => {
      const s = azar.elige(ESCALAS);
      const c = s.paso * azar.entero(2, 12 / s.paso + 3);
      const km = s.km(c);
      const unCm = s.km(1);
      return {
        enunciado: `En un mapa a escala 1:${milesTexto(s.e)}, dos pueblos están a ${c} cm. ¿A cuántos km están en la realidad?`,
        solucion: `${conComa(km)} km`,
        razon: `1 cm del mapa son ${milesTexto(s.e)} cm reales, que son ${conComa(unCm)} km. ${c} cm: ${c} · ${conComa(unCm)} = ${conComa(km)} km.`,
      };
    },
  },
  {
    id: "velocidad",
    crea: (azar) => {
      const v = 10 * azar.entero(6, 12);
      const t = azar.entero(2, 5);
      if (azar.suerte(0.5)) {
        return {
          enunciado: `Un tren va siempre a ${v} km/h. ¿Cuántos km recorre en ${t} horas?`,
          solucion: `${v * t} km`,
          razon: `En 1 hora recorre ${v} km; en ${t} horas, ${t} · ${v} = ${v * t} km.`,
        };
      }
      return {
        enunciado: `Un autobús va siempre a ${v} km/h. ¿Cuántas horas tarda en recorrer ${v * t} km?`,
        solucion: `${t} horas`,
        razon: `Cada hora recorre ${v} km: ${v * t} : ${v} = ${t} horas.`,
      };
    },
  },
  {
    id: "divisas",
    crea: (azar) => {
      const [cambio, moneda] = azar.elige([[110, "dólares"], [120, "dólares"], [125, "dólares"], [80, "libras"], [90, "libras"], [16000, "yenes"]]);
      const e = 10 * azar.entero(2, 15);
      const recibe = cambio * e;
      const c = cantidadDeDinero(cambio);
      return {
        enunciado: `Si 1 € son ${c} ${moneda}, ¿cuántos ${moneda} te dan por ${e} €?`,
        solucion: `${cantidadDeDinero(recibe)} ${moneda}`,
        razon: `Por cada euro te dan ${c} ${moneda}: ${e} · ${c} = ${cantidadDeDinero(recibe)} ${moneda}.`,
      };
    },
  },
  {
    id: "coche",
    crea: (azar) => {
      const g = azar.entero(5, 8);
      const k = 100 * azar.entero(2, 9);
      return {
        enunciado: `Un coche gasta ${g} litros de gasolina cada 100 km. ¿Cuántos litros gasta en ${k} km?`,
        solucion: `${(g * k) / 100} litros`,
        razon: `${k} km son ${k / 100} veces 100 km: ${k / 100} · ${g} = ${(g * k) / 100} litros.`,
      };
    },
  },
  {
    id: "receta",
    crea: (azar) => {
      const g = 25 * azar.entero(2, 8);
      const [p1, p2] = azar.elige([[4, 6], [4, 10], [6, 9], [2, 5], [8, 6], [6, 4], [4, 7]]);
      return {
        enunciado: `Una receta para ${p1} personas lleva ${g * p1} g de harina. ¿Cuánta harina hace falta para ${p2} personas?`,
        solucion: `${g * p2} g`,
        razon: `Para 1 persona: ${g * p1} : ${p1} = ${g} g. Para ${p2}: ${p2} · ${g} = ${g * p2} g.`,
      };
    },
  },
];

function bateria(azar, cuantos, contextos, arma) {
  const plan = azar.mezcla(contextos);
  let i = 0;
  return reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    const p = arma(ctx, azar);
    if (!p) return null;
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${p.solucion}.`,
      texto: `${p.enunciado} ___`,
      solucion: p.solucion,
      contexto: ctx.id,
      razon: p.razon,
      ...(p.sinUnidad ? { sinUnidad: p.sinUnidad } : {}),
    };
  }, { cuantos, clave: (a) => a.contexto }).apartados;
}

// ── "Problemas de reducción a la unidad" (dificultad 2) ─────────────────
export function problemasReduccionUnidad(azar, { cuantos = 3 } = {}) {
  const apartados = bateria(azar, cuantos, UNIDAD, (ctx) => {
    // Cada contexto se usa una vez: si las cantidades no valen, se sortean
    // otras (y no se pierde el contexto).
    let n = null;
    while (!n) n = dosCantidades(azar);
    const p = ctx.crea(azar, n);
    return { ...p, razon: `Primero lo que corresponde a 1: ${p.uno}. Después, ${p.cuenta}.` };
  });
  return {
    clave: "problemas_reduccion_unidad",
    arquetipo: "Resuelve problemas de proporcionalidad directa reduciendo a la unidad",
    enunciado: "Resuelve (calcula primero lo que corresponde a 1):",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Escalas, velocidad, divisas y recetas" (dificultad 3) ──────────────
export function problemasDeProporcionalidad(azar, { cuantos = 3 } = {}) {
  const apartados = bateria(azar, cuantos, CONTEXTOS, (ctx) => ctx.crea(azar));
  return {
    clave: "problemas_proporcionalidad_contextos",
    arquetipo: "Resuelve problemas de escalas, velocidad, divisas y recetas",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
