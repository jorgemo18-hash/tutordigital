// LOS SABERES BÁSICOS QUE TRABAJA CADA EJERCICIO, en el lenguaje del
// currículo. Jorge, 23/9: en la lista de ejercicios, en vez de repetir los
// números (que ya se ven en el folio), *"algo más técnico"*: qué está
// trabajando el ejercicio.
//
// Fuente: anexo de Matemáticas de 1.º ESO de Aragón (ORDEN ECD/1172/2022,
// sección III.2.1), copiado literal en el documento del proyecto
// claude/curriculo-1eso-matematicas.md. Nada de aquí es de cosecha propia:
//
//  - El NOMBRE de cada saber es el del anexo.
//  - La VIÑETA literal solo se da para los conceptos que el documento del
//    currículo relaciona con una viñeta concreta. Valor absoluto, opuesto y
//    quitar paréntesis (conceptos 3, 4 y 9) tienen saber pero ninguna viñeta
//    que los nombre, así que van sin cita en vez de con una forzada.
//  - La jerarquía (concepto 12) no la nombra ningún saber: va marcada como
//    implícita, que es lo que dice el documento.
export const REFERENCIA = "ORDEN ECD/1172/2022 (Aragón)";

export const NOMBRE_DEL_SABER = {
  "A.1": "Conteo",
  "A.2": "Cantidad",
  "A.3": "Sentido de las operaciones",
  "A.4": "Relaciones",
  "A.5": "Razonamiento proporcional",
  "A.6": "Educación financiera",
  "B.1": "Magnitud",
  "B.2": "Medición",
  "B.3": "Estimación y relaciones",
  "C.1": "Figuras geométricas de dos y tres dimensiones",
  "C.4": "Visualización, razonamiento y modelización geométrica",
  "D.1": "Patrones",
  "D.2": "Modelo matemático",
  "D.3": "Variable",
  "D.4": "Igualdad y desigualdad",
  "D.5": "Relaciones y funciones",
};

const CANTIDADES = "Números enteros, fraccionarios y decimales y raíces en la expresión de cantidades en contextos de la vida cotidiana.";
const REPRESENTACION = "Diferentes formas de representación de números enteros, fraccionarios y decimales, incluida la recta numérica.";
const OPERACIONES = "Operaciones con números enteros, fraccionarios o decimales en situaciones contextualizadas.";
const INVERSAS = "Relaciones inversas entre las operaciones (adición y sustracción; multiplicación y división; elevar al cuadrado y extraer la raíz cuadrada): comprensión y utilización en la simplificación y resolución de problemas.";
const PATRONES = "Patrones y regularidades numéricas.";
const COMPARACION = "Comparación y ordenación de fracciones, decimales y porcentajes: situación exacta o aproximada en la recta numérica.";
const GRANDES = "Números grandes y pequeños: notación exponencial y científica y uso de la calculadora.";
const FACTORES = "Factores, múltiplos y divisores. Factorización en números primos para resolver problemas: estrategias y herramientas.";
// Sistema métrico (sentido de la medida, B.1 y B.3).
const ATRIBUTOS = "Atributos mensurables de los objetos físicos y matemáticos: investigación y relación entre los mismos.";
const ELECCION = "Estrategias de elección de las unidades y operaciones adecuadas en problemas que impliquen medida.";
const CONJETURAS = "Formulación de conjeturas sobre medidas o relaciones entre las mismas basadas en estimaciones.";
// Geometría (B.2, C.1, C.4). La de C.1 se copia con la errata del anexo
// ("clasificación de en función"): es una cita, y se comprueba contra el
// texto extraído del PDF.
const ANGULOS = "Medición directa de ángulos y deducción de la medida a partir de las relaciones angulares.";
const AREAS = "Longitud de la circunferencia, áreas en figuras planas: deducción, interpretación y aplicación de fórmulas.";
const REPRESENTACIONES_AREAS = "Representaciones planas de objetos en la visualización y resolución de problemas de áreas.";
const CLASIFICACION = "Figuras geométricas planas y tridimensionales: descripción y clasificación de en función de sus propiedades o características.";
const MODELIZACION_GEO = "Modelización geométrica: relaciones numéricas y algebraicas en la resolución de problemas.";
// Funciones (D.5).
const CUANTITATIVAS = "Relaciones cuantitativas en situaciones de la vida cotidiana y clases de funciones que las modelizan.";
const LINEALES_REPRESENTACION = "Relaciones lineales: identificación y comparación de diferentes modos de representación, tablas, gráficas o expresiones algebraicas, y sus propiedades a partir de ellas.";
const INFORMACION_FUNCION = "Estrategias de deducción de la información relevante de una función mediante el uso de diferentes representaciones simbólicas.";
// Naturales: el conteo (A.1) y el cálculo mental (A.3).
const RECUENTO = "Estrategias variadas de recuento sistemático en situaciones de la vida cotidiana.";
const TAMANO = "Adaptación del conteo al tamaño de los números en problemas de la vida cotidiana.";
const MENTAL = "Estrategias de cálculo mental con números naturales, fracciones y decimales.";
// Decimales: la estimación (A.2) y el efecto de las operaciones (A.3).
const ESTIMACIONES = "Realización de estimaciones con la precisión requerida.";
const EFECTO = "Efecto de las operaciones aritméticas con números enteros, fracciones y expresiones decimales.";
// Razonamiento proporcional y educación financiera (A.5, A.6) y los
// porcentajes raros de A.2.
const RAZONES = "Razones entre magnitudes: comprensión y representación de relaciones cuantitativas.";
const PORCENTAJES = "Porcentajes: comprensión y resolución de problemas.";
const SITUACIONES = "Situaciones de proporcionalidad en diferentes contextos: análisis y desarrollo de métodos para la resolución de problemas (aumentos y disminuciones porcentuales, rebajas y subidas de precios, impuestos, escalas, cambio de divisas, velocidad y tiempo, etc.).";
const PORCENTAJES_RAROS = "Porcentajes mayores que 100 y menores que 1: interpretación.";
const CONSUMO = "Métodos para la toma de decisiones de consumo responsable: relaciones calidad-precio y valor-precio en contextos cotidianos.";
const FINANCIERA = "Información numérica en contextos financieros sencillos: interpretación.";
// Sentido algebraico (bloque D).
const REGLA = "Patrones, pautas y regularidades: observación y determinación de la regla de formación en casos sencillos.";
const MODELIZACION = "Modelización de situaciones de la vida cotidiana usando representaciones matemáticas y el lenguaje algebraico.";
const VARIABLE = "Variable: comprensión del concepto en sus diferentes naturalezas.";
const EQUIVALENCIA = "Equivalencia de expresiones algebraicas en la resolución de problemas basados en relaciones lineales.";
const ECUACIONES = "Estrategias de búsqueda de soluciones en ecuaciones en situaciones de la vida cotidiana.";
const PROPIEDADES = "Propiedades de las operaciones (suma, resta, multiplicación, división y potenciación): cálculos de manera eficiente con números naturales, enteros, fraccionarios y decimales tanto mentalmente como de forma manual, con calculadora u hoja de cálculo.";

// Las citas, para comprobarlas contra el currículo extraído de los PDF
// oficiales (tests/curriculo.test.mjs): dos copias hechas por caminos
// distintos que tienen que coincidir.
export const CITAS = { CANTIDADES, REPRESENTACION, OPERACIONES, PROPIEDADES, INVERSAS, PATRONES, FACTORES, GRANDES, COMPARACION,
  REGLA, MODELIZACION, VARIABLE, EQUIVALENCIA, ECUACIONES,
  RAZONES, PORCENTAJES, SITUACIONES, PORCENTAJES_RAROS, CONSUMO, FINANCIERA,
  ESTIMACIONES, EFECTO, RECUENTO, TAMANO, MENTAL, ATRIBUTOS, ELECCION, CONJETURAS,
  ANGULOS, AREAS, REPRESENTACIONES_AREAS, CLASIFICACION, MODELIZACION_GEO,
  CUANTITATIVAS, LINEALES_REPRESENTACION, INFORMACION_FUNCION };

// Por tema y número de concepto (ver conceptosDelTema.js).
const VINETA_POR_CONCEPTO = {
  "c0000000-0000-4000-8000-000000000001": {
    1: { texto: CANTIDADES },
    2: { texto: CANTIDADES },
    5: { texto: REPRESENTACION },
    6: { texto: REPRESENTACION },
    7: { texto: OPERACIONES },
    8: { texto: OPERACIONES },
    10: { texto: OPERACIONES },
    11: { texto: PROPIEDADES },
    12: { texto: PROPIEDADES, implicito: true },
  },
  // Divisibilidad: los ocho conceptos son la primera viñeta de A.4, que los
  // nombra casi uno a uno (factores, múltiplos, divisores, factorización en
  // primos, "para resolver problemas").
  "c0000000-0000-4000-8000-000000000002": Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, { texto: FACTORES }]),
  ),
  // Potencias y raíces: las potencias y sus propiedades, las potencias de 10
  // y la notación científica, y la raíz como inversa del cuadrado.
  "c0000000-0000-4000-8000-000000000003": {
    1: { texto: PROPIEDADES },
    2: { texto: GRANDES },
    3: { texto: GRANDES },
    4: { texto: PROPIEDADES },
    5: { texto: PROPIEDADES },
    6: { texto: INVERSAS },
    7: { texto: INVERSAS },
  },
  // Fracciones.
  "c0000000-0000-4000-8000-000000000004": {
    1: { texto: OPERACIONES },
    2: { texto: REPRESENTACION },
    3: { texto: REPRESENTACION },
    4: { texto: COMPARACION },
    5: { texto: OPERACIONES },
    6: { texto: OPERACIONES },
    7: { texto: PROPIEDADES, implicito: true },
    8: { texto: OPERACIONES },
  },
  // Números naturales. El sistema de numeración (1) no lo nombra ningún
  // saber de 1.º con esas palabras; lo más cercano es «adaptación del
  // conteo al tamaño de los números» (A.1), y así se cita.
  "c0000000-0000-4000-8000-000000000008": {
    1: { texto: TAMANO },
    2: { texto: ESTIMACIONES },
    3: { texto: INVERSAS },
    4: { texto: MENTAL },
    5: { texto: RECUENTO },
    6: { texto: OPERACIONES },
  },
  // Funciones y gráficas.
  "c0000000-0000-4000-8000-000000000011": {
    1: { texto: LINEALES_REPRESENTACION },
    2: { texto: LINEALES_REPRESENTACION },
    3: { texto: LINEALES_REPRESENTACION },
    4: { texto: INFORMACION_FUNCION },
    5: { texto: CUANTITATIVAS },
  },
  // Geometría plana.
  "c0000000-0000-4000-8000-000000000010": {
    1: { texto: ANGULOS },
    2: { texto: ANGULOS },
    3: { texto: CLASIFICACION },
    4: { texto: AREAS },
    5: { texto: AREAS },
    6: { texto: AREAS },
    7: { texto: MODELIZACION_GEO },
  },
  // Sistema métrico decimal.
  "c0000000-0000-4000-8000-000000000009": {
    1: { texto: ATRIBUTOS },
    2: { texto: ELECCION },
    3: { texto: ELECCION },
    4: { texto: ELECCION },
    5: { texto: CONJETURAS },
    6: { texto: ELECCION },
  },
  // Números decimales.
  "c0000000-0000-4000-8000-000000000007": {
    1: { texto: CANTIDADES },
    2: { texto: REPRESENTACION },
    3: { texto: COMPARACION },
    4: { texto: ESTIMACIONES },
    5: { texto: OPERACIONES },
    6: { texto: OPERACIONES },
    7: { texto: EFECTO },
    8: { texto: OPERACIONES },
  },
  // Proporcionalidad y porcentajes: A.5 casi palabra por palabra.
  "c0000000-0000-4000-8000-000000000006": {
    1: { texto: RAZONES },
    2: { texto: RAZONES },
    3: { texto: SITUACIONES },
    4: { texto: SITUACIONES },
    5: { texto: PORCENTAJES },
    6: { texto: PORCENTAJES },
    7: { texto: SITUACIONES },
    8: { texto: CONSUMO },
  },
  // Álgebra: cada concepto tiene su viñeta del bloque D casi palabra por
  // palabra. D.4 también dice «resolución mediante el uso de la
  // tecnología», que aquí no se cita: en 1.º no se deja calculadora.
  "c0000000-0000-4000-8000-000000000005": {
    1: { texto: MODELIZACION },
    2: { texto: VARIABLE },
    3: { texto: EQUIVALENCIA },
    4: { texto: REGLA },
    5: { texto: ECUACIONES },
    6: { texto: ECUACIONES },
    7: { texto: ECUACIONES },
    8: { texto: MODELIZACION },
  },
};

// ALGUNOS TIPOS DE EJERCICIO TRABAJAN UN SABER MÁS CONCRETO que el de su
// concepto, y así lo dicen las instrucciones de su arquetipo en la migración
// 120 y el documento del currículo:
//  - las series numéricas cubren A.4 «patrones y regularidades numéricas»
//    (aunque su concepto, orden y comparación, sea A.2);
//  - «halla el término que falta» y «halla el factor que falta» cubren A.3
//    «relaciones inversas entre las operaciones».
// Es lo que hace que la línea de cada ejercicio diga algo propio y no lo
// mismo que la de al lado (Jorge, 23/9: el saber, en cada ejercicio).
const SABER_POR_BATERIA = {
  series_numericas: { codigo: "A.4", texto: PATRONES },
  termino_que_falta: { codigo: "A.3", texto: INVERSAS },
  factor_que_falta: { codigo: "A.3", texto: INVERSAS },
  // Potencias y raíces: hallar la base o el exponente es la operación inversa.
  potencia_que_falta: { codigo: "A.3", texto: INVERSAS },
  // Fracciones: el total a partir de una parte es la operación inversa.
  cantidad_desde_fraccion: { codigo: "A.3", texto: INVERSAS },
  // Proporcionalidad: los porcentajes de más de 100 y de menos de 1 (siempre
  // hay uno de cada en esa batería) los nombra A.2; leer una promoción es
  // la «información numérica en contextos financieros» de A.6.
  porcentaje_fraccion_decimal: { codigo: "A.2", texto: PORCENTAJES_RAROS },
  promociones: { codigo: "A.6", texto: FINANCIERA },
  // Naturales: la distributiva y el factor común son «propiedades de las
  // operaciones», no trucos de cálculo mental.
  distributiva_naturales: { codigo: "A.3", texto: PROPIEDADES },
  factor_comun_naturales: { codigo: "A.3", texto: PROPIEDADES },
  // Medida: elegir la unidad es la «elección de las unidades» de B.1.
  unidad_adecuada: { codigo: "B.1", texto: ELECCION },
  // Geometría: los problemas de pintar y embaldosar son «representaciones
  // planas de objetos… problemas de áreas» (B.2), no modelización.
  problemas_de_areas: { codigo: "B.2", texto: REPRESENTACIONES_AREAS },
};

// { codigo, nombre, vineta, implicito, referencia } o null si el concepto no
// tiene saber. `clave`: la batería, por si tiene un saber propio.
export function saberBasico(temaId, concepto, codigoDelConcepto, clave = null) {
  const propio = SABER_POR_BATERIA[clave];
  const codigo = propio?.codigo || codigoDelConcepto;
  if (!codigo) return null;
  const vineta = propio ? { texto: propio.texto } : VINETA_POR_CONCEPTO[temaId]?.[concepto] || null;
  return {
    codigo,
    nombre: NOMBRE_DEL_SABER[codigo] || null,
    vineta: vineta?.texto || null,
    implicito: Boolean(vineta?.implicito),
    referencia: REFERENCIA,
  };
}
