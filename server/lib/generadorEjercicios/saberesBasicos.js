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
  "A.2": "Cantidad",
  "A.3": "Sentido de las operaciones",
  "A.4": "Relaciones",
};

const CANTIDADES = "Números enteros, fraccionarios y decimales y raíces en la expresión de cantidades en contextos de la vida cotidiana.";
const REPRESENTACION = "Diferentes formas de representación de números enteros, fraccionarios y decimales, incluida la recta numérica.";
const OPERACIONES = "Operaciones con números enteros, fraccionarios o decimales en situaciones contextualizadas.";
const INVERSAS = "Relaciones inversas entre las operaciones (adición y sustracción; multiplicación y división; elevar al cuadrado y extraer la raíz cuadrada): comprensión y utilización en la simplificación y resolución de problemas.";
const PATRONES = "Patrones y regularidades numéricas.";
const PROPIEDADES = "Propiedades de las operaciones (suma, resta, multiplicación, división y potenciación): cálculos de manera eficiente con números naturales, enteros, fraccionarios y decimales tanto mentalmente como de forma manual, con calculadora u hoja de cálculo.";

// Las citas, para comprobarlas contra el currículo extraído de los PDF
// oficiales (tests/curriculo.test.mjs): dos copias hechas por caminos
// distintos que tienen que coincidir.
export const CITAS = { CANTIDADES, REPRESENTACION, OPERACIONES, PROPIEDADES, INVERSAS, PATRONES };

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
