import * as sumaResta from "../generadores/sumaResta.js";
import * as producto from "../generadores/producto.js";
import * as potencias from "../generadores/potencias.js";
import * as combinadas from "../generadores/combinadas.js";
import * as reconocer from "../generadores/reconocer.js";
import * as absolutoOpuesto from "../generadores/absolutoOpuesto.js";
import * as recta from "../generadores/recta.js";


// EL TEMA «NÚMEROS ENTEROS» DE 1.º ESO: sus objetivos, qué batería sirve a
// cada uno y los nombres de sus conceptos.
//
// Hasta el 25/9 esto vivía suelto en catalogoDeBaterias.js, que era a la vez
// "el catálogo" y "el catálogo de enteros": con un solo tema no se notaba.
// Con el segundo (Divisibilidad), cada tema es un archivo de esta carpeta y
// catalogoDeBaterias.js solo sabe recorrer el que le pasen.

// EL TÍTULO DE CADA OBJETIVO, para encabezar su bloque en la hoja.
//
// Está aquí y no inventado en la plantilla porque es CONTENIDO: sale de los
// objetivos sembrados en la migración 123, palabra por palabra. Es la misma
// costura que los arquetipos y tiene el mismo guardián: un test comprueba que
// cada uno de estos títulos aparece LITERALMENTE en esa migración, para que
// renombrar un objetivo en la base de datos no deje la hoja titulando algo
// que ya no existe.
const TITULO_DE_OBJETIVO = {
  1: "Reconocer y ordenar números enteros",
  2: "Valor absoluto y opuesto",
  3: "Sumar y restar enteros",
  4: "Quitar paréntesis y signos",
  5: "Multiplicar, dividir y elevar a potencias",
  6: "Resolver operaciones combinadas",
};

// LA `clave` ESTÁ DUPLICADA A PROPÓSITO. La escribe el generador dentro de
// cada ejercicio, y aquí se repite porque hay dos sitios que la necesitan SIN
// generar nada: la tabla de alturas medidas (`alturasMedidas.js`, indexada
// por clave) y el montador, que tiene que estimar cuánto ocupa una batería
// antes de armarla. Un test comprueba que la clave del catálogo es la misma
// que escribe el generador.

// `concepto` es el número del concepto del catálogo (c1000000-…-00N en la
// migración 120) al que pertenece el arquetipo de la batería. Lo usa el
// montador para que una hoja cubra cada concepto del objetivo antes de poner
// dos del mismo (ver cubreConceptos.js), y un test comprueba contra las
// migraciones que es el concepto de verdad del arquetipo.

// Los rangos de apartados salen de las instrucciones de los arquetipos
// sembrados, no de lo que caiga bien: "de 6 a 9 apartados", "de 3 a 4
// apartados", "de 2 a 4". Cuando el montador tiene que recortar una hoja,
// recorta hasta el mínimo del arquetipo y no por debajo.
const BATERIAS_POR_OBJETIVO = {
  // 1. Reconocer y ordenar números enteros. Falta el verdadero/falso
  //    justificado (la respuesta es un razonamiento escrito, no algo que se
  //    pueda corregir comparando; ver generadores/reconocer.js).
  //    "Ordena" cuenta LISTAS: dos o tres listas de seis o siete números.
  //    Las de la recta cuentan RECTAS: dos o tres, cada una con su dibujo.
  1: [
    {
      generador: reconocer.asociaEnteroASituacion,
      clave: "asocia_entero_situacion", concepto: 1,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: recta.representaEnRecta,
      clave: "representa_en_recta", concepto: 6,
      dificultad: 1, minimo: 2, maximo: 3,
    },
    {
      generador: recta.leeLaRecta,
      clave: "lee_la_recta", concepto: 6,
      dificultad: 1, minimo: 2, maximo: 3,
    },
    {
      generador: reconocer.comparaEnteros,
      clave: "compara_enteros", concepto: 5,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: reconocer.ordenaLista,
      clave: "ordena_lista", concepto: 5,
      dificultad: 1, minimo: 2, maximo: 3,
    },
    {
      generador: recta.leeLaRectaGraduada,
      clave: "lee_la_recta_graduada", concepto: 6,
      dificultad: 2, minimo: 2, maximo: 3,
    },
    {
      generador: recta.representaEnRectaGraduada,
      clave: "representa_en_recta_graduada", concepto: 6,
      dificultad: 2, minimo: 2, maximo: 3,
    },
    {
      generador: reconocer.seriesNumericas,
      clave: "series_numericas", concepto: 5,
      dificultad: 2, minimo: 4, maximo: 5,
    },
  ],

  // 2. Valor absoluto y opuesto.
  2: [
    {
      generador: absolutoOpuesto.valorAbsoluto,
      clave: "valor_absoluto", concepto: 3,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: absolutoOpuesto.escribeOpuesto,
      clave: "escribe_opuesto", concepto: 4,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: absolutoOpuesto.encadenadosOpuestoAbsoluto,
      clave: "encadenados_opuesto_absoluto", concepto: 4,
      dificultad: 2, minimo: 4, maximo: 6,
    },
  ],

  3: [
    {
      generador: sumaResta.sumaMismoSigno,
      clave: "suma_mismo_signo", concepto: 7,
      dificultad: 1, minimo: 6, maximo: 9,
    },
    {
      generador: sumaResta.sumaDistintoSigno,
      clave: "suma_distinto_signo", concepto: 7,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: sumaResta.restaConParentesis,
      clave: "resta_con_parentesis", concepto: 8,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: sumaResta.terminoQueFalta,
      clave: "termino_que_falta", concepto: 7,
      dificultad: 2, minimo: 4, maximo: 6,
    },
    {
      generador: sumaResta.cadenaSumasRestas,
      clave: "cadena_sumas_restas", concepto: 7,
      dificultad: 2, minimo: 3, maximo: 4,
    },
  ],

  4: [
    {
      generador: sumaResta.eliminaParentesis,
      clave: "elimina_parentesis", concepto: 9,
      dificultad: 2, minimo: 3, maximo: 4,
    },
  ],

  5: [
    {
      generador: producto.multiplicaDosEnteros,
      clave: "multiplica_dos_enteros", concepto: 10,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: producto.divideDosEnteros,
      clave: "divide_dos_enteros", concepto: 10,
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: potencias.potenciasDeBaseEntera,
      clave: "potencias_base_entera", concepto: 11,
      dificultad: 2, minimo: 5, maximo: 8,
    },
    {
      generador: producto.factorQueFalta,
      clave: "factor_que_falta", concepto: 10,
      dificultad: 2, minimo: 4, maximo: 6,
    },
    {
      generador: producto.cadenaProductosCocientes,
      clave: "cadena_productos_cocientes", concepto: 10,
      dificultad: 2, minimo: 3, maximo: 4,
    },
    {
      generador: potencias.paresConYSinParentesis,
      clave: "pares_con_y_sin_parentesis", concepto: 11,
      dificultad: 3, minimo: 4, maximo: 6,
    },
  ],

  6: [
    {
      generador: combinadas.combinadaDeUnNivel,
      clave: "combinada_un_nivel", concepto: 12,
      dificultad: 2, minimo: 3, maximo: 4,
    },
    {
      generador: combinadas.subrayaLaPreferente,
      clave: "subraya_la_preferente", concepto: 12,
      dificultad: 2, minimo: 4, maximo: 6,
    },
    {
      generador: combinadas.combinadaConCorchetes,
      clave: "combinada_con_corchetes", concepto: 12,
      dificultad: 3, minimo: 2, maximo: 4,
    },
  ],
};

// LOS NOMBRES DE LOS CONCEPTOS, copiados LITERAL de la migración 120 (un
// test lo comprueba), y su saber básico (columna `saber` de la misma).
const CONCEPTOS = {
  1: "Situaciones que piden un número con signo",
  2: "El conjunto Z: positivos, negativos y el cero",
  3: "Valor absoluto",
  4: "Opuesto de un entero",
  5: "Orden y comparación de enteros",
  6: "Representación en la recta numérica",
  7: "Suma de enteros del mismo y de distinto signo",
  8: "Resta como suma del opuesto",
  9: "Eliminación de paréntesis y signos",
  10: "Producto y cociente: la regla de los signos",
  11: "Potencias de base entera",
  12: "Jerarquía de operaciones con enteros",
};

const SABERES = {
  1: "A.2", 2: "A.2", 3: "A.2", 4: "A.2", 5: "A.2", 6: "A.2",
  7: "A.3", 8: "A.3", 9: "A.3", 10: "A.3", 11: "A.3", 12: "A.3",
};

export const ENTEROS_1ESO = {
  id: "c0000000-0000-4000-8000-000000000001",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Números enteros",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  // El id de cada concepto en la base de datos (c1…NN de la migración 120).
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  // Dónde está sembrado, para los tests que vigilan la costura código ↔ base
  // de datos (catalogoDeBaterias.test.mjs).
  // Los módulos de generadores del tema: un test comprueba que ninguna
  // función exportada se queda sin registrar en `baterias`.
  modulos: [sumaResta, producto, potencias, combinadas, reconocer, absolutoOpuesto, recta],
  migraciones: {
    objetivos: ["123_contenido_objetivos.sql"],
    arquetipos: ["120_semilla_enteros_1eso.sql", "127_arquetipos_recta_numerica.sql"],
    conceptos: ["120_semilla_enteros_1eso.sql"],
  },
};
