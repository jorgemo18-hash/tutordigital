import * as potencias from "../generadores/potenciasRaices/potencias.js";
import * as notacion from "../generadores/potenciasRaices/notacion.js";
import * as propiedades from "../generadores/potenciasRaices/propiedades.js";
import * as raices from "../generadores/potenciasRaices/raices.js";

// EL TEMA «POTENCIAS Y RAÍCES» DE 1.º ESO (migración 136).
//
// Todo con números naturales y sin calculadora. Lo que se queda fuera, y
// por qué, está en la cabecera de la migración: los números pequeños en
// notación científica y las combinadas con raíces.
//
// Mismas reglas que los otros temas (ver enteros1eso.js).

const TITULO_DE_OBJETIVO = {
  1: "Calcular potencias de números naturales",
  2: "Usar las potencias de 10 y la notación científica",
  3: "Operar con potencias de la misma base",
  4: "Calcular raíces cuadradas",
};

const BATERIAS_POR_OBJETIVO = {
  1: [
    { generador: potencias.escribeComoPotencia, clave: "escribe_como_potencia", concepto: 1, dificultad: 1, minimo: 5, maximo: 7 },
    { generador: potencias.calculaPotencia, clave: "calcula_potencia", concepto: 1, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: potencias.potenciaQueFalta, clave: "potencia_que_falta", concepto: 1, dificultad: 2, minimo: 4, maximo: 6 },
    { generador: potencias.comparaPotencias, clave: "compara_potencias", concepto: 1, dificultad: 2, minimo: 4, maximo: 6 },
  ],
  2: [
    { generador: notacion.potenciasDeDiez, clave: "potencias_de_diez", concepto: 2, dificultad: 1, minimo: 5, maximo: 7 },
    { generador: notacion.descomposicionPolinomica, clave: "descomposicion_polinomica", concepto: 2, dificultad: 2, minimo: 3, maximo: 4 },
    { generador: notacion.notacionCientifica, clave: "notacion_cientifica", concepto: 3, dificultad: 2, minimo: 4, maximo: 6 },
  ],
  3: [
    { generador: propiedades.productoMismaBase, clave: "producto_misma_base", concepto: 4, dificultad: 1, minimo: 5, maximo: 7 },
    { generador: propiedades.cocienteMismaBase, clave: "cociente_misma_base", concepto: 4, dificultad: 1, minimo: 5, maximo: 7 },
    { generador: propiedades.potenciaDePotencia, clave: "potencia_de_potencia", concepto: 5, dificultad: 2, minimo: 4, maximo: 6 },
    { generador: propiedades.propiedadesMezcladas, clave: "propiedades_mezcladas", concepto: 5, dificultad: 3, minimo: 3, maximo: 4 },
  ],
  4: [
    { generador: raices.raizExacta, clave: "raiz_exacta", concepto: 6, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: raices.raizEntreDos, clave: "raiz_entre_dos", concepto: 7, dificultad: 2, minimo: 4, maximo: 6 },
    { generador: raices.raizEntera, clave: "raiz_entera", concepto: 7, dificultad: 2, minimo: 4, maximo: 6 },
  ],
};

const CONCEPTOS = {
  1: "Potencias de base natural",
  2: "Potencias de 10 y descomposición polinómica",
  3: "Notación científica de números grandes",
  4: "Producto y cociente de potencias de la misma base",
  5: "Potencia de una potencia",
  6: "Raíz cuadrada exacta",
  7: "Raíz cuadrada entera y resto",
};

const SABERES = { 1: "A.3", 2: "A.2", 3: "A.2", 4: "A.3", 5: "A.3", 6: "A.3", 7: "A.3" };

export const POTENCIAS_RAICES_1ESO = {
  id: "c0000000-0000-4000-8000-000000000003",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Potencias y raíces",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`,
  modulos: [potencias, notacion, propiedades, raices],
  migraciones: {
    objetivos: ["136_semilla_potencias_raices_1eso.sql"],
    arquetipos: ["136_semilla_potencias_raices_1eso.sql"],
    conceptos: ["136_semilla_potencias_raices_1eso.sql"],
  },
};
