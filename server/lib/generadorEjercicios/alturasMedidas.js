// ALTURAS MEDIDAS DE CADA BATERÍA, EN MILÍMETROS DE FOLIO.
//
// ARCHIVO GENERADO: lo escribe `tests/manual/calibraAlturas.mjs` midiendo la
// hoja en Chromium. No se edita a mano — se vuelve a pasar el script.
//
// Medido el 2026-09-23 con 12 semillas por batería.
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
export const ALTO_UTIL_POR_FOLIO_MM = 275;

export const ALTURA_DEL_TITULO_DE_BLOQUE_MM = 9.6;
export const ALTURA_DE_LA_CABECERA_MM = 35.9;
export const ALTURA_DEL_PIE_MM = 5.8;

export const ALTURA_DE_LA_BATERIA_MM = {
  asocia_entero_situacion: { minimo: 60.1, medio: 66.7, maximo: 73.4 },
  cadena_productos_cocientes: { minimo: 52.1, medio: 58.8, maximo: 58.8 },
  cadena_sumas_restas: { minimo: 52.1, medio: 58.8, maximo: 58.8 },
  combinada_con_corchetes: { minimo: 47.3, medio: 53.9, maximo: 60.6 },
  combinada_un_nivel: { minimo: 47.1, medio: 53.8, maximo: 53.8 },
  compara_enteros: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  divide_dos_enteros: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  elimina_parentesis: { minimo: 49.3, medio: 49.3, maximo: 49.3 },
  encadenados_opuesto_absoluto: { minimo: 46.8, medio: 53.5, maximo: 60.1 },
  escribe_opuesto: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  factor_que_falta: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  multiplica_dos_enteros: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  ordena_lista: { minimo: 43.2, medio: 54.7, maximo: 54.7 },
  pares_con_y_sin_parentesis: { minimo: 32.2, medio: 32.2, maximo: 38.8 },
  potencias_base_entera: { minimo: 38.1, medio: 44.8, maximo: 44.8 },
  resta_con_parentesis: { minimo: 43.9, medio: 50.6, maximo: 50.6 },
  series_numericas: { minimo: 46.8, medio: 53.5, maximo: 53.5 },
  subraya_la_preferente: { minimo: 53.8, medio: 60.4, maximo: 67.1 },
  suma_distinto_signo: { minimo: 40.1, medio: 46.8, maximo: 46.8 },
  suma_mismo_signo: { minimo: 41.9, medio: 48.6, maximo: 55.3 },
  termino_que_falta: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
  valor_absoluto: { minimo: 33.5, medio: 40.1, maximo: 40.1 },
};
