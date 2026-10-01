import { MetodosDelTemaSchema } from "./esquema.js";
import { METODOS_ALGEBRA_1ESO } from "./algebra1eso.js";

// LOS MÉTODOS DE TODOS LOS TEMAS, por id de tema. Se validan al cargar: un
// método mal escrito tiene que romper los tests, no la conversación de un
// alumno.
const TEMAS = [METODOS_ALGEBRA_1ESO].map((t) => MetodosDelTemaSchema.parse(t));
const POR_TEMA = new Map(TEMAS.map((t) => [t.tema, t]));

export function temasConMetodo() {
  return TEMAS;
}

// null si ese tema o esa batería aún no tienen método: el tutor sigue como
// hasta ahora (sin pasos comprobables), no se rompe.
export function metodoDe({ tema, clave }) {
  const t = POR_TEMA.get(tema);
  const m = t?.porClave[clave];
  if (!m) return null;
  return { hitos: m.hitos, erroresDeCualquierPaso: t.erroresDeCualquierPaso };
}
