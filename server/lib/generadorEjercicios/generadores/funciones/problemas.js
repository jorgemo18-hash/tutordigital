import { reuneApartados } from "../../ejercicio.js";
import { expresion, escribe } from "./escritura.js";

// FUNCIONES, OBJETIVO 4: RELACIONES LINEALES EN CONTEXTO (concepto 5). Saber
// D.5: «Relaciones cuantitativas en situaciones de la vida cotidiana y
// clases de funciones que las modelizan».
//
// Cada situación tiene una parte FIJA y una que va POR UNIDAD: la expresión
// es y = (por unidad) · x + (fija). Es exactamente donde está el error 4:
// intercambiarlas.

const SITUACIONES = [
  {
    id: "taxi",
    crea: (azar) => ({ a: azar.entero(1, 2), b: azar.entero(3, 5), x: azar.entero(4, 12),
      frase: (a, b) => `Un taxi cobra ${b} € al subir y ${a} € por kilómetro.`, xNombre: "los km", yNombre: "el precio en €", pregunta: (x) => `¿Cuánto cuesta un viaje de ${x} km?`, unidad: "€" }),
  },
  {
    id: "gimnasio",
    crea: (azar) => ({ a: azar.entero(3, 6), b: 10 * azar.entero(2, 5), x: azar.entero(4, 10),
      frase: (a, b) => `Un gimnasio cobra ${b} € de matrícula y ${a} € por cada clase.`, xNombre: "las clases", yNombre: "lo que se paga en €", pregunta: (x) => `¿Cuánto paga quien va a ${x} clases?`, unidad: "€" }),
  },
  {
    id: "planta",
    crea: (azar) => ({ a: azar.entero(2, 4), b: azar.entero(5, 15), x: azar.entero(3, 10),
      frase: (a, b) => `Una planta mide ${b} cm y crece ${a} cm cada semana.`, xNombre: "las semanas", yNombre: "la altura en cm", pregunta: (x) => `¿Cuánto medirá dentro de ${x} semanas?`, unidad: "cm" }),
  },
  {
    id: "vela",
    crea: (azar) => ({ a: -azar.entero(1, 2), b: azar.entero(18, 30), x: azar.entero(3, 8),
      frase: (a, b) => `Una vela mide ${b} cm y se consume ${-a} cm cada hora.`, xNombre: "las horas", yNombre: "lo que mide en cm", pregunta: (x) => `¿Cuánto medirá después de ${x} horas?`, unidad: "cm" }),
  },
  {
    id: "hucha",
    crea: (azar) => ({ a: azar.entero(2, 5), b: azar.entero(6, 20), x: azar.entero(5, 12),
      frase: (a, b) => `Pedro tiene ${b} € en la hucha y mete ${a} € cada semana.`, xNombre: "las semanas", yNombre: "el dinero en €", pregunta: (x) => `¿Cuánto tendrá dentro de ${x} semanas?`, unidad: "€" }),
  },
];

// ── "Expresión y valor en una situación" (dificultad 3) ─────────────────
export function problemasFuncionLineal(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(SITUACIONES);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const s = plan[i];
    i += 1;
    if (!s) return null;
    const { a, b, x, frase, xNombre, yNombre, pregunta, unidad } = s.crea(azar);
    if (Math.abs(a) === b) return null;
    const y = a * x + b;
    const enunciado = `${frase(a, b)} Si x son ${xNombre} e y ${yNombre}, escribe la expresión. ${pregunta(x)}`;
    return {
      latex: `${enunciado} y = ___; ___ ${unidad}`,
      latexResuelto: `${enunciado} y = ${expresion(a, b)}; ${y} ${unidad}`,
      texto: `${enunciado} → y = ___; ___`,
      solucion: [`y = ${expresion(a, b)}`, `${y} ${unidad}`],
      contexto: s.id,
      cambiada: [`y = ${expresion(b, a)}`, `${b * x + a} ${unidad}`],
      razon: `Lo que cambia con x va multiplicando (${expresion(a, 0)}); lo fijo se suma (${b}). y = ${expresion(a, b)}; para x = ${x}: ${escribe(a)} · ${x} + ${b} = ${y} ${unidad}.`,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "problemas_funcion_lineal",
    arquetipo: "Escribe la expresión de una situación lineal y úsala",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}

const TARIFAS = [
  { que: "Dos compañías de teléfono", fija: "al mes", unidad: "minuto", plural: "minutos" },
  { que: "Dos academias de música", fija: "de matrícula", unidad: "clase", plural: "clases" },
  { que: "Dos alquileres de bicicletas", fija: "por la fianza", unidad: "hora", plural: "horas" },
  { que: "Dos piscinas", fija: "de abono", unidad: "entrada", plural: "entradas" },
];

// ── "¿Qué tarifa sale mejor?" (dificultad 3) ────────────────────────────
// De 2 a 3: la de menos parte fija es la más cara por unidad, y para la
// cantidad que se pregunta sale mejor LA OTRA. Así, comparar solo lo fijo
// (error 5) falla.
export function comparaTarifas(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(TARIFAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const t = plan[i];
    if (!t) return null;
    const fa = azar.entero(2, 10); const pa = azar.entero(3, 6);
    const fb = fa + azar.entero(5, 20); const pb = azar.entero(1, pa - 1);
    // Se igualan en x = (fb − fa) / (pa − pb); se pregunta bastante después.
    const corte = (fb - fa) / (pa - pb);
    const n = Math.ceil(corte) + azar.entero(2, 6);
    const [ca, cb] = [fa + pa * n, fb + pb * n];
    if (ca === cb) return null;
    i += 1;
    const frase = `${t.que}: A cobra ${fa} € ${t.fija} y ${pa} € por ${t.unidad}; B, ${fb} € ${t.fija} y ${pb} € por ${t.unidad}. ¿Cuál sale más barata para ${n} ${t.plural}?`;
    const mejor = ca < cb ? "A" : "B";
    return {
      latex: `${frase} ___`,
      latexResuelto: `${frase} ${mejor} (A: ${ca} €; B: ${cb} €).`,
      texto: `${frase} ___`,
      solucion: mejor,
      contexto: t.que,
      soloLoFijo: fa < fb ? "A" : "B",
      razon: `A: ${fa} + ${pa} · ${n} = ${ca} €. B: ${fb} + ${pb} · ${n} = ${cb} €. Sale mejor ${mejor}: con muchas ${t.plural} pesa más lo que se paga por cada una que lo fijo.`,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "compara_tarifas",
    arquetipo: "Compara dos tarifas lineales",
    enunciado: "Escribe lo que cuesta cada tarifa y contesta A o B:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
