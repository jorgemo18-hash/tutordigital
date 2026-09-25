// ALTURAS MEDIDAS DE CADA BATERÍA, EN MILÍMETROS DE FOLIO.
//
// ARCHIVO GENERADO: lo escribe `tests/manual/calibraAlturas.mjs` midiendo la
// hoja en Chromium. No se edita a mano — se vuelve a pasar el script.
//
// Medido el 2026-09-25 con 12 semillas por batería.
// Cada número es el MÁXIMO de las semillas, no la media: una batería no mide
// siempre lo mismo (la explicación del ejemplo resuelto varía), y pasarse de
// folio es peor defecto que dejar blanco.
//
// SI CAMBIA EL CSS DE LA HOJA O EL CUERPO DE LETRA, ESTOS NÚMEROS MIENTEN.
// Hay un test que compara la lista de claves con el catálogo, pero ninguno
// puede detectar que la letra ha crecido: eso solo lo ve el navegador.

// El alto que queda para contenido en UN folio: 297 menos los dos márgenes
// de `@page`. Medido, no escrito: es el padding de la hoja en pantalla, que
// es el mismo número que el margen de impresión (lo vigila un test).
export const ALTO_UTIL_POR_FOLIO_MM = 277;

export const ALTURA_DEL_TITULO_DE_BLOQUE_MM = 9.6;
export const ALTURA_DE_LA_CABECERA_MM = 35.9;
export const ALTURA_DEL_PIE_MM = 5.8;

export const ALTURA_DE_LA_BATERIA_MM = {
  asocia_entero_situacion: { minimo: 60.1, medio: 66.7, maximo: 73.4 },
  cadena_productos_cocientes: { minimo: 52.1, medio: 58.8, maximo: 58.8 },
  cadena_sumas_restas: { minimo: 50.1, medio: 56.8, maximo: 56.8 },
  calcula_potencia: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  cantidad_desde_fraccion: { minimo: 53.2, medio: 63.2, maximo: 73.1 },
  cifra_que_falta: { minimo: 41.2, medio: 48.1, maximo: 48.1 },
  cociente_misma_base: { minimo: 40.1, medio: 40.1, maximo: 40.1 },
  combinada_con_corchetes: { minimo: 49.3, medio: 55.9, maximo: 62.6 },
  combinada_fracciones: { minimo: 53.2, medio: 63.2, maximo: 63.2 },
  combinada_fracciones_parentesis: { minimo: 46.1, medio: 57.6, maximo: 57.6 },
  combinada_un_nivel: { minimo: 45.1, medio: 51.8, maximo: 51.8 },
  compara_enteros: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  compara_fracciones: { minimo: 43.3, medio: 53.2, maximo: 53.2 },
  compara_potencias: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  comprueba_solucion: { minimo: 55, medio: 62, maximo: 68.9 },
  continua_multiplos: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  descompon_en_factores: { minimo: 37.3, medio: 40.1, maximo: 40.1 },
  descomposicion_polinomica: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  divide_dos_enteros: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  divide_fracciones: { minimo: 53.2, medio: 63.2, maximo: 63.2 },
  divisible_por: { minimo: 40.1, medio: 40.1, maximo: 46.8 },
  ecuacion_con_parentesis: { minimo: 41.2, medio: 48.1, maximo: 48.1 },
  ecuacion_dos_pasos: { minimo: 45, medio: 45, maximo: 51.9 },
  ecuacion_producto_cociente: { minimo: 45.5, medio: 54.5, maximo: 54.5 },
  ecuacion_suma_resta: { minimo: 41.2, medio: 48.1, maximo: 48.1 },
  ecuacion_x_dos_lados: { minimo: 48.1, medio: 55, maximo: 62 },
  elimina_parentesis: { minimo: 49.3, medio: 49.3, maximo: 49.3 },
  encadenados_opuesto_absoluto: { minimo: 46.8, medio: 53.5, maximo: 60.1 },
  entero_y_fraccion: { minimo: 43.3, medio: 53.2, maximo: 53.2 },
  equivalente_que_falta: { minimo: 53.5, medio: 53.5, maximo: 63.4 },
  es_divisor_por_factores: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  es_multiplo_o_divisor: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  escribe_como_potencia: { minimo: 40.1, medio: 40.1, maximo: 46.8 },
  escribe_opuesto: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  factor_que_falta: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  fraccion_de_cantidad: { minimo: 53.2, medio: 63.2, maximo: 63.2 },
  fraccion_de_fraccion: { minimo: 43.3, medio: 53.2, maximo: 53.2 },
  lee_la_recta: { minimo: 82.8, medio: 106.1, maximo: 106.1 },
  lee_la_recta_graduada: { minimo: 82.8, medio: 106.1, maximo: 106.1 },
  mcd_de_dos: { minimo: 40.1, medio: 46.8, maximo: 53.5 },
  mcd_y_mcm_de_tres: { minimo: 37.3, medio: 43.9, maximo: 43.9 },
  mcm_de_dos: { minimo: 40.1, medio: 46.8, maximo: 53.5 },
  multiplica_dos_enteros: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  multiplica_fracciones: { minimo: 53.2, medio: 63.2, maximo: 63.2 },
  multiplos_entre: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  notacion_cientifica: { minimo: 41.2, medio: 52.7, maximo: 52.7 },
  numero_desde_factores: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  ordena_fracciones: { minimo: 41.3, medio: 51.2, maximo: 51.2 },
  ordena_lista: { minimo: 43.2, medio: 54.7, maximo: 54.7 },
  pares_con_y_sin_parentesis: { minimo: 32.2, medio: 32.2, maximo: 38.8 },
  potencia_de_potencia: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  potencia_que_falta: { minimo: 34.3, medio: 41.2, maximo: 41.2 },
  potencias_base_entera: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  potencias_de_diez: { minimo: 40.7, medio: 40.9, maximo: 47.6 },
  primo_o_compuesto: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  primos_entre: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  problemas_ecuacion_numeros: { minimo: 31.8, medio: 38.4, maximo: 38.4 },
  problemas_ecuacion_repartos: { minimo: 46.4, medio: 53, maximo: 53 },
  problemas_fraccion_cantidad: { minimo: 38.6, medio: 45.3, maximo: 45.3 },
  problemas_lo_que_queda: { minimo: 38.6, medio: 50.2, maximo: 50.2 },
  problemas_mcd: { minimo: 57, medio: 68.5, maximo: 68.5 },
  problemas_mcm: { minimo: 52.2, medio: 63.7, maximo: 63.7 },
  problemas_mezclados: { minimo: 55, medio: 66.5, maximo: 66.5 },
  producto_misma_base: { minimo: 40.1, medio: 40.1, maximo: 40.1 },
  propiedades_mezcladas: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  raiz_entera: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  raiz_entre_dos: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  raiz_exacta: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  reduce_con_parentesis: { minimo: 48.1, medio: 55, maximo: 62 },
  reduce_semejantes: { minimo: 41.2, medio: 41.2, maximo: 48.1 },
  representa_en_recta: { minimo: 82.8, medio: 106.1, maximo: 106.1 },
  representa_en_recta_graduada: { minimo: 86.7, medio: 109.9, maximo: 109.9 },
  resta_con_parentesis: { minimo: 43.9, medio: 50.6, maximo: 50.6 },
  series_numericas: { minimo: 44.8, medio: 51.5, maximo: 51.5 },
  siguientes_terminos: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  simplifica_fraccion: { minimo: 43.3, medio: 53.2, maximo: 53.2 },
  son_equivalentes: { minimo: 53.2, medio: 63.2, maximo: 63.2 },
  subraya_la_preferente: { minimo: 53.8, medio: 60.4, maximo: 67.1 },
  suma_distinto_denominador: { minimo: 53.2, medio: 53.2, maximo: 63.2 },
  suma_distinto_signo: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  suma_mismo_denominador: { minimo: 53.2, medio: 63.2, maximo: 63.2 },
  suma_mismo_signo: { minimo: 43.9, medio: 50.6, maximo: 57.3 },
  termino_general: { minimo: 41.2, medio: 48.1, maximo: 48.1 },
  termino_lejano: { minimo: 38.1, medio: 44.8, maximo: 44.8 },
  termino_que_falta: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  todos_los_divisores: { minimo: 43.9, medio: 50.6, maximo: 50.6 },
  traduce_enunciado: { minimo: 40.4, medio: 49.2, maximo: 49.2 },
  valor_absoluto: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  valor_numerico: { minimo: 41.2, medio: 48.1, maximo: 48.1 },
};
