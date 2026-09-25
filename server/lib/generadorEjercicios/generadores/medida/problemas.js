import { reuneApartados } from "../../ejercicio.js";
import { texto, dec, producto, cociente, resta } from "../decimales/decimal.js";
import { euros, cantidadDeDinero } from "../proporcionalidad/numeros.js";

// MEDIDA, OBJETIVO 5: PROBLEMAS DE MEDIDA (concepto 6). Saber B.1:
// «Estrategias de elección de las unidades y operaciones adecuadas en
// problemas que impliquen medida».
//
// En todos hay que PASAR A LA MISMA UNIDAD antes de operar: es lo que
// distingue un problema de medida de uno de números. Plantillas escritas a
// mano, datos que salen de la solución, solo unidades que se usan de verdad
// (unidades.js, USUALES) y la aritmética de decimal.js.

const CONTEXTOS = [
  {
    id: "vasos",
    crea: (azar) => {
      const vaso = azar.elige([200, 250]);
      const n = azar.entero(4, 12);
      const litros = cociente(dec(vaso * n), dec(1000));
      if (!litros || litros.e > 2) return null;
      return {
        enunciado: `¿Cuántos vasos de ${vaso} mL se llenan con una garrafa de ${texto(litros)} L?`,
        solucion: String(n),
        razon: `Todo en mL: ${texto(litros)} L = ${vaso * n} mL. ${vaso * n} : ${vaso} = ${n} vasos.`,
      };
    },
  },
  {
    id: "vueltas",
    crea: (azar) => {
      const pista = azar.elige([200, 250, 400, 500]);
      const vueltas = azar.entero(3, 15);
      const km = cociente(dec(pista * vueltas), dec(1000));
      if (!km || km.e > 2) return null;
      return {
        enunciado: `Una pista de atletismo mide ${pista} m. ¿Cuántas vueltas hay que dar para correr ${texto(km)} km?`,
        solucion: String(vueltas),
        razon: `Todo en metros: ${texto(km)} km = ${pista * vueltas} m. ${pista * vueltas} : ${pista} = ${vueltas} vueltas.`,
      };
    },
  },
  {
    id: "paquetes",
    crea: (azar) => {
      const gramos = azar.elige([125, 200, 250, 500]);
      const n = azar.entero(4, 16);
      const kg = cociente(dec(gramos * n), dec(1000));
      if (!kg || kg.e > 3) return null;
      return {
        enunciado: `Se reparten ${texto(kg)} kg de arroz en paquetes de ${gramos} g. ¿Cuántos paquetes salen?`,
        solucion: String(n),
        razon: `Todo en gramos: ${texto(kg)} kg = ${gramos * n} g. ${gramos * n} : ${gramos} = ${n} paquetes.`,
      };
    },
  },
  {
    id: "cuerda",
    crea: (azar) => {
      const total = dec(azar.entero(3, 12));
      const trozo = azar.elige([25, 40, 50, 75]);
      const trozos = azar.entero(2, 5);
      const usado = dec(trozo * trozos);
      const quedaCm = resta(producto(total, dec(100)), usado);
      if (quedaCm.n <= 0) return null;
      return {
        enunciado: `De una cuerda de ${texto(total)} m se cortan ${trozos} trozos de ${trozo} cm. ¿Cuántos cm quedan?`,
        solucion: `${texto(quedaCm)} cm`,
        razon: `Todo en cm: ${texto(total)} m = ${texto(producto(total, dec(100)))} cm. Se usan ${trozos} · ${trozo} = ${texto(usado)} cm, y quedan ${texto(quedaCm)} cm.`,
      };
    },
  },
  {
    id: "botellas",
    crea: (azar) => {
      const [capacidad, cL] = azar.elige([[dec(15, 1), 150], [dec(2), 200], [dec(33, 2), 33], [dec(75, 2), 75], [dec(5, 1), 50]]);
      const botellas = azar.entero(3, 8);
      return {
        enunciado: `Se llenan ${botellas} ${cL === 33 ? "latas" : "botellas"} de ${cL} cL. ¿Cuántos litros se usan?`,
        solucion: `${texto(producto(capacidad, dec(botellas)))} L`,
        razon: `${cL} cL = ${texto(capacidad)} L. ${botellas} · ${texto(capacidad)} = ${texto(producto(capacidad, dec(botellas)))} L.`,
      };
    },
  },
];

// ── "Problemas de medida" (dificultad 2) ────────────────────────────────
export function problemasDeMedida(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(CONTEXTOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
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
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "problemas_de_medida",
    arquetipo: "Resuelve problemas pasando a la misma unidad",
    enunciado: "Resuelve (pasa antes a la misma unidad):",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// Problemas con dos pasos: una unidad en el precio o en el ritmo y otra en
// la cantidad (queso a tanto el kilo, comprado en gramos).
const DOS_PASOS = [
  {
    id: "queso",
    crea: (azar) => {
      const gramos = azar.elige([250, 500, 750, 200, 400]);
      const euroKg = azar.entero(8, 24);
      const paga = (euroKg * gramos) / 1000;
      if (!Number.isInteger(paga * 100)) return null;
      return {
        enunciado: `El queso cuesta ${euroKg} € el kilo. ¿Cuánto cuestan ${gramos} g?`,
        solucion: `${euros(Math.round(paga * 100))}`,
        razon: `${gramos} g son ${texto(cociente(dec(gramos), dec(1000)))} kg: ${texto(cociente(dec(gramos), dec(1000)))} · ${euroKg} = ${euros(Math.round(paga * 100))}.`,
      };
    },
  },
  {
    id: "fuga",
    crea: (azar) => {
      const mlMin = azar.elige([2, 3, 4, 5, 6]);
      const horas = azar.elige([5, 10, 24]);
      const ml = mlMin * 60 * horas;
      const litros = cociente(dec(ml), dec(1000));
      return {
        enunciado: `Un grifo gotea ${mlMin} mL cada minuto. ¿Cuántos litros se pierden en ${horas} horas?`,
        solucion: `${texto(litros)} L`,
        razon: `${horas} horas son ${horas * 60} minutos: ${horas * 60} · ${mlMin} = ${texto(dec(ml))} mL = ${texto(litros)} L.`,
      };
    },
  },
  {
    id: "cafe",
    crea: (azar) => {
      const gramos = azar.elige([250, 500, 200]);
      const kilo = azar.entero(10, 24);
      const precio = (kilo * gramos) / 1000;
      if (!Number.isInteger(precio * 100)) return null;
      return {
        enunciado: `Un paquete de ${gramos} g de café cuesta ${euros(Math.round(precio * 100))}. ¿A cuánto sale el kilo?`,
        solucion: `${kilo} €`,
        razon: `1 kg = 1000 g, que son ${1000 / gramos} paquetes: ${1000 / gramos} · ${cantidadDeDinero(Math.round(precio * 100))} = ${kilo} €.`,
      };
    },
  },
  {
    id: "folios",
    crea: (azar) => {
      const hojas = azar.elige([500, 250, 100]);
      const gHoja = azar.entero(4, 6);
      const kg = cociente(dec(hojas * gHoja), dec(1000));
      return {
        enunciado: `Un paquete de ${hojas} folios pesa ${texto(kg)} kg. ¿Cuántos gramos pesa cada folio?`,
        solucion: `${gHoja} g`,
        razon: `${texto(kg)} kg = ${hojas * gHoja} g, entre ${hojas}: ${gHoja} g.`,
      };
    },
  },
  {
    id: "tela",
    crea: (azar) => {
      const cm = azar.elige([150, 250, 75, 120, 80]);
      const euroM = azar.entero(4, 15);
      const paga = (euroM * cm) / 100;
      return {
        enunciado: `La tela cuesta ${euroM} € el metro. ¿Cuánto cuestan ${cm} cm?`,
        solucion: `${euros(Math.round(paga * 100))}`,
        razon: `${cm} cm son ${texto(cociente(dec(cm), dec(100)))} m: ${texto(cociente(dec(cm), dec(100)))} · ${euroM} = ${euros(Math.round(paga * 100))}.`,
      };
    },
  },
];

// ── "Problemas de dos pasos" (dificultad 3) ─────────────────────────────
export function problemasDosPasos(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(DOS_PASOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
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
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "problemas_medida_dos_pasos",
    arquetipo: "Resuelve problemas de medida y precio en dos pasos",
    enunciado: "Resuelve (cuidado con las unidades del precio):",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
