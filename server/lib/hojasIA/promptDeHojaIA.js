// LO QUE SE LE PIDE A LA IA PARA ESCRIBIR UNA HOJA DE UN TEMA QUE NO TIENE
// GENERADOR PROPIO (fase 3 del generador, decidida con Jorge el 30/9: "que
// lo haga la IA con las órdenes que tiene, y con ejemplos de referencia").
//
// La IA ESCRIBE los ejercicios, pero no se cree lo que escribe: cada apartado
// que se puede calcular trae su `comprobar` en notación de ordenador y el
// servidor lo resuelve (server/lib/verificador/). Lo que no cuadra no llega a
// la hoja. Lo que no se puede calcular sale marcado "sin verificar".
export const HERRAMIENTA = "escribir_hoja";

const COMPROBACION = {
  type: "object",
  description: "Cómo comprobar un apartado con el ordenador. Notación: multiplicación con *, potencia ^, fracciones con /, raíz sqrt(), pi. Nunca 2x: 2*x.",
  properties: {
    tipo: { type: "string", enum: ["ecuacion", "sistema", "igualdad", "valor", "estadistica"] },
    apartado: { type: "string", description: "La letra del apartado (a, b, c…), si hay varios." },
    ecuacion: { type: "string", description: "tipo ecuacion: \"2*x-5 = 4*x-7\"." },
    var: { type: "string", description: "tipo ecuacion: la incógnita si no es x." },
    ecuaciones: { type: "array", items: { type: "string" }, description: "tipo sistema." },
    vars: { type: "array", items: { type: "string" }, description: "tipo sistema: [\"x\",\"y\"]." },
    expresion: { type: "string", description: "tipo igualdad o valor: lo que hay que calcular o simplificar." },
    datos: { type: "array", items: { type: "number" }, description: "tipo estadistica." },
    medida: { type: "string", enum: ["media", "mediana", "moda", "rango"] },
    respuesta: {
      description: "ecuacion: lista de soluciones [\"3/2\"], o \"sin solución\" / \"identidad\". sistema: {\"x\":\"2\",\"y\":\"-1\"}. igualdad: la expresión simplificada. valor: el número. estadistica: el número (moda: lista).",
    },
    tolerancia: { type: "number", description: "tipo valor: para resultados redondeados." },
  },
  required: ["tipo", "respuesta"],
};

export const ESQUEMA = {
  type: "object",
  properties: {
    ejercicios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["ejercicio", "problema"] },
          subtipo: { type: "string", description: "Qué tipo de ejercicio es, corto: \"ecuaciones con denominadores\"." },
          dificultad: { type: "integer", enum: [1, 2, 3] },
          saber: { type: "string", description: "Código del saber básico que trabaja (de la lista dada)." },
          enunciado: { type: "string", description: "La consigna. Matemáticas en LaTeX entre $…$." },
          apartados: { type: "array", items: { type: "string" }, description: "Cada apartado en LaTeX entre $…$, sin la letra." },
          solucion: { type: "string", description: "La solución para el profesor (no se imprime). En LaTeX entre $…$ lo matemático." },
          comprobar: { type: "array", items: COMPROBACION },
        },
        required: ["tipo", "subtipo", "dificultad", "saber", "enunciado", "solucion"],
      },
    },
  },
  required: ["ejercicios"],
};

export function promptDeHojaIA({ materia, curso, tema }) {
  return [
    `Eres profesor de ${materia} de ${curso} en un centro de Aragón. Escribes los ejercicios de una hoja del tema «${tema}».`,
    "Reglas:",
    "- Ejercicios NUEVOS: los de referencia te dicen el nivel, los tipos y la notación del curso; no copies ninguno (cambia los números, las situaciones y las palabras).",
    "- Cada ejercicio trabaja uno de los saberes básicos que se te dan (pon su código) y no se sale de lo que dicen para este curso.",
    "- Mezcla técnica y problemas de contexto real y cercano; varía los tipos; de menos a más difícil.",
    "- Números amables para hacer a mano (sin calculadora, salvo que el tema la pida); soluciones limpias salvo que el tipo de ejercicio pida otra cosa.",
    "- Matemáticas en LaTeX entre $…$; decimales con coma ({,} en LaTeX); en español de España.",
    "- En cada apartado que se pueda calcular, su `comprobar` con la respuesta: el servidor la resuelve y si no cuadra, ese apartado se quita (y en un problema, el ejercicio entero). En los problemas, el `comprobar` es la ecuación del planteamiento.",
    "- La `solucion` tiene que decir los mismos resultados que el `comprobar`.",
    "- Nada de dibujos: si un ejercicio necesita una figura, descríbela con datos (coordenadas, medidas) o elige otro.",
  ].join("\n");
}

export function mensajeDeHojaIA({ saberes, referencias, cuantos, dificultad, yaHay = [] }) {
  const lineasSaberes = saberes.map((s) => `${s.codigo} ${s.nombre}: ${s.textos.join(" / ")}`);
  const lineasRef = referencias.map((r, i) => `${i + 1}. [${r.tipo}, dificultad ${r.dificultad}, ${r.saberes.join(", ")}] ${r.enunciado}\n   Solución: ${r.solucion}`);
  const nivel = dificultad ? `Dificultad: sobre todo ${dificultad} (de 1 a 3).` : "Dificultad: variada, de 1 a 3.";
  return [
    `SABERES BÁSICOS DEL TEMA (currículo de Aragón, literal):\n${lineasSaberes.join("\n")}`,
    `EJERCICIOS DE REFERENCIA (nivel y tipos; no los copies):\n${lineasRef.join("\n")}`,
    `ESCRIBE ${cuantos} ejercicios. ${nivel} Cada ejercicio con 1 a 6 apartados.`,
    ...(yaHay.length ? [`La hoja ya tiene ejercicios de estos tipos; escribe de otros: ${yaHay.join("; ")}.`] : []),
  ].join("\n\n");
}
