import { reuneApartados } from "../ejercicio.js";
import { escribeNumero } from "../explicacion.js";

// OBJETIVO 1: RECONOCER Y ORDENAR ENTEROS (conceptos 1, 2, 5 y 6).
//
// Cuatro de sus seis arquetipos. Los dos que faltan, y por qué:
//
//   - "Representa estos números en la recta" y "lee la recta" necesitan un
//     DIBUJO, y el dibujo lo hace nuestro código y no un modelo (decisión de
//     curriculo-1eso-matematicas.md). Van aparte, con su renderizador SVG.
//   - "Verdadero o falso, justificando con un ejemplo" pide al alumno que
//     ESCRIBA un razonamiento. Eso no tiene una solución que se pueda
//     comparar, y su corrección es de la misma familia que los enunciados con
//     texto, que se aparcaron hasta tener una pantalla donde el profesor
//     revise lo generado.
//
// Como en el objetivo 2, aquí no hay expresiones: cada apartado trae su
// `razon` escrita para cuando sale como ejemplo resuelto.

const coma = ",\\; ";

// ── "Asocia un entero a cada enunciado cotidiano" (dificultad 1) ─────────
//
// Instrucción: de 6 a 8 situaciones, mezclando contextos (dinero,
// temperatura, plantas, altitud, fechas), y al menos dos positivas "para que
// no se conteste todo con negativos".
//
// SON PLANTILLAS, NO TEXTO GENERADO. Cada una lleva su número y su signo
// escritos a mano, así que la solución es segura. Es el concepto donde vive
// el error de interpretación del catálogo ("baja 5 grados" traducido con el
// signo contrario), y por eso cada contexto tiene su versión positiva y su
// versión negativa: si un contexto saliera solo en negativo, el alumno
// aprendería "termómetro = menos" en vez de leer la frase.
const ORDINALES = { 1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto" };

const SITUACIONES = [
  { contexto: "temperatura", signo: -1, rango: [1, 12], frase: (n) => `El termómetro marca ${n} grados bajo cero`,
    porque: "“Bajo cero” es por debajo del cero: negativo." },
  { contexto: "temperatura", signo: 1, rango: [8, 38], frase: (n) => `Hace ${n} grados sobre cero`,
    porque: "“Sobre cero” es por encima del cero: positivo." },
  { contexto: "plantas", signo: -1, rango: [1, 3], frase: (n) => `Tengo el coche en el ${ORDINALES[n]} sótano`,
    porque: "Los sótanos están por debajo de la planta baja, que es el cero: negativo." },
  { contexto: "plantas", signo: 1, rango: [1, 4], frase: (n) => `Vivo en el ${ORDINALES[n]} piso`,
    porque: "Los pisos están por encima de la planta baja, que es el cero: positivo." },
  { contexto: "dinero", signo: -1, rango: [5, 60], frase: (n) => `Le debo ${n} € a mi hermano`,
    porque: "Una deuda es dinero que falta: negativo." },
  { contexto: "dinero", signo: 1, rango: [5, 90], frase: (n) => `Tengo ${n} € ahorrados`,
    porque: "Dinero que tienes: positivo." },
  { contexto: "altitud", signo: -1, rango: [5, 40], frase: (n) => `Un buzo está a ${n} metros bajo el nivel del mar`,
    porque: "El nivel del mar es el cero, y por debajo es negativo." },
  { contexto: "altitud", signo: 1, rango: [300, 3400], frase: (n) => `El pico está a ${n} metros sobre el nivel del mar`,
    porque: "El nivel del mar es el cero, y por encima es positivo." },
  { contexto: "puntos", signo: -1, rango: [2, 20], frase: (n) => `En el juego he perdido ${n} puntos`,
    porque: "Perder puntos es restar: negativo." },
  { contexto: "puntos", signo: 1, rango: [2, 20], frase: (n) => `En el juego he ganado ${n} puntos`,
    porque: "Ganar puntos es sumar: positivo." },
];

export function asociaEnteroASituacion(azar, { cuantos = 6 } = {}) {
  // Dos positivas primero —el mínimo del arquetipo— y el resto sorteado
  // favoreciendo los negativos, que son lo que se está aprendiendo.
  const positivas = azar.mezcla(SITUACIONES.filter((s) => s.signo > 0)).slice(0, 2);
  const resto = azar.mezcla(SITUACIONES.filter((s) => !positivas.includes(s)));
  const plan = azar.mezcla([...positivas, ...resto.filter((s) => s.signo < 0)])
    .concat(resto.filter((s) => s.signo > 0));

  let i = 0;
  const { apartados } = reuneApartados(() => {
    const s = plan[i];
    i += 1;
    if (!s) return null;
    const n = azar.entero(...s.rango);
    const solucion = s.signo * n;
    const signado = solucion > 0 ? `+${solucion}` : String(solucion);
    return {
      latex: `${s.frase(n)}: ___`,
      latexResuelto: `${s.frase(n)}: $${signado}$`,
      texto: `${s.frase(n)}: ___`,
      solucion,
      razon: `${s.porque.replace(/\.$/, "")}, ${signado.replace("-", "\u2212")}.`,
    };
  // Una situación por frase: dos "tengo el coche en el sótano" en la misma
  // batería son la misma pregunta dos veces.
  }, { cuantos, clave: (a) => a.texto.replace(/\d+/g, "#") });

  return {
    clave: "asocia_entero_situacion",
    arquetipo: "Asocia un entero a cada enunciado cotidiano",
    enunciado: "Escribe el número entero que corresponde a cada situación:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Completa con el signo > o <" (dificultad 1) ─────────────────────────
//
// Instrucción: de 6 a 8 parejas; al menos la mitad deben ser DOS NEGATIVOS,
// "que es donde está el error", y alguna con el 0.
//
// El error del catálogo es ordenar los negativos por su valor absoluto
// ("-8 > -3 porque 8 > 3"), y solo lo provoca una pareja de dos negativos
// con valores absolutos distintos. Las demás parejas están para que la
// batería no se conteste con una regla fija ("el de la izquierda es menor").
function parejaDeTipo(azar, tipo) {
  const a = azar.entero(1, 25);
  let b = azar.entero(1, 25);
  if (b === a) b = a + azar.entero(1, 6);
  if (tipo === "dos_negativos") return [-a, -b];
  if (tipo === "con_cero") return azar.suerte(0.5) ? [0, -a] : [-a, 0];
  return azar.suerte(0.5) ? [a, -b] : [-a, b];
}

function razonComparacion(x, y) {
  const mayor = Math.max(x, y);
  const menor = Math.min(x, y);
  if (x < 0 && y < 0) {
    return `Entre dos negativos es mayor el que está más cerca del cero: `
      + `${escribeNumero(mayor)} está a la derecha de ${escribeNumero(menor)} en la recta.`;
  }
  if (x === 0 || y === 0) {
    return mayor === 0
      ? `Todo negativo es menor que 0: ${escribeNumero(menor)} < 0.`
      : `Todo positivo es mayor que 0: ${mayor} > 0.`;
  }
  return "Cualquier positivo es mayor que cualquier negativo.";
}

export function comparaEnteros(azar, { cuantos = 6 } = {}) {
  const dosNegativos = Math.ceil((cuantos) / 2);
  const tipos = [
    ...Array.from({ length: dosNegativos }, () => "dos_negativos"),
    "con_cero",
    "signos_distintos",
  ];
  // SIN PAREJAS DE DOS POSITIVOS en los huecos libres, y salió de mirar la
  // primera tanda: el apartado que se convirtió en ejemplo resuelto fue
  // `12 < 17`. El ejemplo sale del último hueco, que es libre, y un ejemplo
  // de dos positivos enseña lo único que el alumno ya sabía desde primaria.
  // Con dos negativos pesando el doble, el ejemplo casi siempre enseña la
  // dificultad del tema.
  while (tipos.length < cuantos + 20) tipos.push(azar.elige(["signos_distintos", "dos_negativos", "dos_negativos"]));
  // Los obligatorios se mezclan entre sí pero van delante de los libres: el
  // último, que es el que se hace ejemplo, sale siempre de los libres.
  const plan = [...azar.mezcla(tipos.slice(0, dosNegativos + 2)), ...tipos.slice(dosNegativos + 2)];

  let i = 0;
  const { apartados } = reuneApartados(() => {
    const tipo = plan[i];
    i += 1;
    if (!tipo) return null;
    const [x, y] = parejaDeTipo(azar, tipo);
    const signo = x < y ? "<" : ">";
    return {
      latex: `$${x}$ ___ $${y}$`,
      latexResuelto: `$${x} ${signo} ${y}$`,
      texto: `${x} ___ ${y}`,
      solucion: signo,
      // Los dos números, para las respuestas-trampa (errores/): del texto
      // habría que sacarlos con una expresión regular.
      pareja: [x, y],
      razon: razonComparacion(x, y),
    };
  // La misma pareja al revés también cuenta como repetida: `-3 ___ -8` y
  // `-8 ___ -3` se contestan el segundo dando la vuelta al primero.
  }, { cuantos, clave: (a) => a.texto.split(" ___ ").map(Number).sort((p, q) => p - q).join("|") });

  return {
    clave: "compara_enteros",
    arquetipo: "Completa con el signo > o <",
    enunciado: "Completa con el signo > o <:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

// ── "Ordena una lista de menor a mayor" (dificultad 1) ───────────────────
//
// Instrucción: una lista de 6 a 10 enteros mezclando signos y magnitudes,
// "con al menos dos negativos de dos o tres cifras para que no valga
// ordenar a ojo". Cada APARTADO es una lista; la batería lleva dos o tres.
//
// La respuesta va en huecos separados por "<" y no en una línea libre: así
// se ve cuántos números hay que escribir, y se corrige hueco a hueco.
export function ordenaLista(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const largo = azar.entero(6, 7);
    const numeros = new Set([-azar.entero(12, 250), -azar.entero(12, 250)]);
    // Siempre algún positivo y algún negativo de una cifra, que es donde
    // ordenar "por el número sin signo" da justo el orden contrario.
    numeros.add(azar.entero(1, 9));
    numeros.add(-azar.entero(1, 9));
    while (numeros.size < largo) numeros.add(azar.signo() * azar.entero(1, 150));
    const lista = azar.mezcla([...numeros]);
    const ordenada = [...lista].sort((p, q) => p - q);
    const huecos = ordenada.map(() => "___").join(" $<$ ");
    return {
      latex: `$${lista.join(coma)}$ → ${huecos}`,
      latexResuelto: `$${lista.join(coma)}$ → $${ordenada.join(" < ")}$`,
      texto: `${lista.join(", ")} → ${ordenada.map(() => "___").join(" < ")}`,
      solucion: ordenada,
      lista,
      razon: "Primero los negativos, del más lejano al cero al más cercano; luego los positivos, "
        + "de menor a mayor.",
    };
  }, { cuantos });

  return {
    clave: "ordena_lista",
    arquetipo: "Ordena una lista de menor a mayor",
    enunciado: "Ordena de menor a mayor:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Series numéricas: escribe los tres términos siguientes" (dif. 2) ────
//
// Instrucción: de 4 a 5 series que cruzan el cero hacia los negativos. Paso
// constante, o una diferencia creciente sencilla — "nada que requiera
// adivinar".
//
// CRUZAR EL CERO ES LA MITAD DEL EJERCICIO: una serie que ya empieza en
// negativos se hace restando como con naturales. Por eso se empieza siempre
// en positivo y se muestran cinco términos que llegan a cero o lo pasan.
function unaSerie(azar, creciente) {
  const paso = azar.entero(2, 7);
  const terminos = [];
  if (!creciente) {
    // Cinco términos que empiezan en positivo y terminan en cero o por
    // debajo: empieza entre 1 y 3 pasos por encima del cero.
    let t = paso * azar.entero(1, 3) + (azar.suerte(0.5) ? 0 : azar.entero(1, paso - 1));
    for (let k = 0; k < 8; k += 1) { terminos.push(t); t -= paso; }
    return { terminos, regla: `Cada término es ${paso} menos que el anterior` };
  }
  // Diferencia creciente de 1 en 1: resta 1, luego 2, luego 3…
  let t = azar.entero(4, 9);
  for (let k = 0, d = 1; k < 8; k += 1, d += 1) { terminos.push(t); t -= d; }
  return { terminos, regla: "Lo que se resta crece de 1 en 1" };
}

export function seriesNumericas(azar, { cuantos = 4 } = {}) {
  let hechas = 0;
  const { apartados } = reuneApartados(() => {
    // Una de cada tres, de diferencia creciente: es la que obliga a mirar la
    // regla y no solo el primer salto.
    const creciente = hechas % 3 === 2;
    hechas += 1;
    const { terminos, regla } = unaSerie(azar, creciente);
    const vistos = terminos.slice(0, 5);
    const siguientes = terminos.slice(5, 8);
    // Que cruce el cero dentro de lo que se enseña o de lo que se pide.
    if (vistos[0] <= 0 || siguientes[2] >= 0) return null;
    const cuentas = siguientes.map((t, k) => {
      const previo = k === 0 ? vistos[4] : siguientes[k - 1];
      return `${escribeNumero(previo)} − ${previo - t} = ${escribeNumero(t)}`;
    }).join("; ");
    return {
      latex: `$${vistos.join(coma)},$ ___, ___, ___`,
      // Los tres de la respuesta SUBRAYADOS: sin marca, el ejemplo resuelto
      // era una fila de ocho números y no se veía cuáles había que escribir.
      // Subrayado y no en negrita porque imita la raya del hueco.
      latexResuelto: `$${vistos.join(coma)},\\; ${siguientes.map((t) => `\\underline{${t}}`).join(coma)}$`,
      texto: `${vistos.join(", ")}, ___, ___, ___`,
      solucion: siguientes,
      razon: `${regla}: ${cuentas}.`,
    };
  }, { cuantos });

  return {
    clave: "series_numericas",
    arquetipo: "Series numéricas: escribe los tres términos siguientes",
    enunciado: "Escribe los tres términos siguientes de cada serie:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
