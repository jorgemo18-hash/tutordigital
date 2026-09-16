// De las filas de la base de datos al contrato que dibuja el PDF.
//
// NO CALCULA NADA PROPIO: las filas y el reparto de alumnos salen de
// `bloquesDeConfig` y `filasDelCuadrante`, las mismas funciones que pinta la
// pantalla. Es la única forma de que el papel y el cuadrante que Jorge tiene
// delante no digan cosas distintas del mismo martes — el mismo criterio que ya
// se documentó en ocupacionHoja.js para la hoja de familias.

import { bloquesDeConfig } from "../../../assets/shared/js/horarioBloques.js";
import { filasDelCuadrante } from "../../../assets/shared/js/textoDelCuadrante.js";

// TIENE QUE PEDIR TODO LO QUE LEE ESTE MÓDULO, y hay un test que compara esta
// lista con el código de abajo. El precedente es real y caro: a la hoja de
// familias le faltaban dos columnas en el select y la rejilla salía impecable y
// vacía, sin un solo error — `undefined` se lee como "no hay tope", que es un
// estado legítimo (ver hojaFamilias.routes.js).
export const COLUMNAS_CONFIG =
  "franja_inicio, franja_fin, franja_inicio_2, franja_fin_2, franja_duracion, " +
  "dias_laborables, max_alumnos_por_franja";

const DIAS_POR_DEFECTO = [1, 2, 3, 4, 5];

export function diasDeConfig(config = {}) {
  const valores = Array.isArray(config?.dias_laborables) && config.dias_laborables.length
    ? config.dias_laborables
    : DIAS_POR_DEFECTO;
  return [...valores].sort((a, b) => a - b);
}

// El título lo decide el SERVIDOR a partir del rol y del ámbito, nunca el
// cliente: un documento que sale del backend no lleva texto que venga en la
// URL. Y además así el papel no puede mentir sobre de quién es el horario.
export function tituloDelCuadrante({ ambitoProfesor = false, role = "" } = {}) {
  if (ambitoProfesor || role === "teacher") return "Horario semanal · mis clases";
  return "Horario del centro";
}

export function construirPayloadCuadrante({
  franjas = [],
  config = {},
  centro = "",
  titulo = "Horario semanal",
  sinNombres = false,
  hoyISO,
} = {}) {
  const bloques = bloquesDeConfig(config || {});
  const dias = diasDeConfig(config);
  const maxPorFranja = Number(config?.max_alumnos_por_franja) || 0;

  const { columnas, filas } = filasDelCuadrante({
    franjas,
    dias,
    bloques,
    maxPorFranja,
    sinNombres,
    ...(hoyISO ? { hoyISO } : {}),
  });

  return { columnas, filas, titulo, centro };
}
