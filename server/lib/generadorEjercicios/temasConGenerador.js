import { OBJETIVOS } from "./catalogoDeBaterias.js";

// LOS TEMAS PARA LOS QUE HAY GENERADOR, con su curso y su materia.
//
// El panel ofrece curso → materia → tema → objetivo. Jorge, el 23/9: *"tendría
// que poderse elegir curso, materia y tema"*. La lista sale de AQUÍ y no de
// todos los temas de la base de datos: un tema sin generador escrito no se
// puede montar, y ofrecerlo sería un selector que falla al elegirlo.
//
// Hoy hay UNO. Los selectores de la pantalla ya existen y crecerán solos
// cuando entre el segundo tema. El `id` es el de la fila del tema en la
// migración 120 (catálogo común), y un test comprueba que esa fila existe con
// este curso, esta materia y este nombre, para que el panel no ofrezca un
// tema con otro nombre que el de la base de datos.
//
// AVISO PARA EL SEGUNDO TEMA: hoy el catálogo de baterías (`OBJETIVOS`) es
// el de este tema, sin más. Cuando haya dos, el catálogo tendrá que ir por
// tema; está dicho aquí para que no se descubra a golpe de error.
export const TEMAS_CON_GENERADOR = [
  {
    id: "c0000000-0000-4000-8000-000000000001",
    curso: "1.º ESO",
    materia: "Matemáticas",
    nombre: "Números enteros",
    objetivos: OBJETIVOS,
  },
];

export function temaPorId(id) {
  return TEMAS_CON_GENERADOR.find((t) => t.id === id) || null;
}
