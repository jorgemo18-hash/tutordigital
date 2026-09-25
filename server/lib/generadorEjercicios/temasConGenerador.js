import { ENTEROS_1ESO } from "./temas/enteros1eso.js";
import { DIVISIBILIDAD_1ESO } from "./temas/divisibilidad1eso.js";
import { POTENCIAS_RAICES_1ESO } from "./temas/potenciasRaices1eso.js";
import { FRACCIONES_1ESO } from "./temas/fracciones1eso.js";
import { ALGEBRA_1ESO } from "./temas/algebra1eso.js";
import { PROPORCIONALIDAD_1ESO } from "./temas/proporcionalidad1eso.js";
import { objetivosDe } from "./catalogoDeBaterias.js";

// LOS TEMAS PARA LOS QUE HAY GENERADOR, con su curso y su materia.
//
// El panel ofrece curso → materia → tema → objetivo. Jorge, el 23/9: *"tendría
// que poderse elegir curso, materia y tema"*. La lista sale de AQUÍ y no de
// todos los temas de la base de datos: un tema sin generador escrito no se
// puede montar, y ofrecerlo sería un selector que falla al elegirlo.
//
// Cada tema es un archivo de temas/. El `id` es el de su fila en la base de
// datos (catálogo común), y un test comprueba que esa fila existe en las
// migraciones con este curso, esta materia y este nombre, para que el panel
// no ofrezca un tema con otro nombre que el de la base de datos.
// Enteros sigue el primero aunque en los materiales vaya después (el orden
// de los demás sí es el del curso: potencias, tema 2; divisibilidad, tema 3): es el tema que el panel abre por defecto (el primero de la lista),
// y cambiárselo a quien ya lo usa por añadir otro sería una sorpresa.
export const TEMAS_CON_GENERADOR = [ENTEROS_1ESO, POTENCIAS_RAICES_1ESO, DIVISIBILIDAD_1ESO, FRACCIONES_1ESO, PROPORCIONALIDAD_1ESO, ALGEBRA_1ESO];

export function temaPorId(id) {
  return TEMAS_CON_GENERADOR.find((t) => t.id === id) || null;
}

// Los números de objetivo de un tema (atajo para quien solo tiene el id).
export function objetivosDelTema(id) {
  const tema = temaPorId(id);
  return tema ? objetivosDe(tema) : [];
}
