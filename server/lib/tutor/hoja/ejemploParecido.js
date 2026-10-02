// UN EJEMPLO PARECIDO, CON OTROS NÚMEROS, PARA EL PELDAÑO 3 DE LA ESCALERA.
//
// Lo hace el generador de hojas de la misma batería: mismo tipo de
// ejercicio, cuentas comprobadas y su explicación paso a paso (`razon`), que
// es la del ejemplo resuelto de la hoja. Sin IA. Nunca el mismo ejercicio
// que tiene el alumno.
import { TEMAS_CON_GENERADOR } from "../../generadorEjercicios/temasConGenerador.js";
import { crearAzar } from "../../generadorEjercicios/aleatorio.js";

export function ejemploParecido({ temaId, clave, distintoDe = "", semilla = "ejemplo" }) {
  const tema = TEMAS_CON_GENERADOR.find((t) => t.id === temaId);
  const bateria = tema && Object.values(tema.baterias).flat().find((b) => b.clave === clave);
  if (!bateria) return null;
  for (let i = 0; i < 6; i += 1) {
    const a = bateria.generador(crearAzar(`${semilla}-${i}`), { cuantos: 1 }).apartados[0];
    if (a?.texto && a.texto !== distintoDe && a.razon) return { texto: a.texto, solucion: a.solucion, razon: a.razon };
  }
  return null;
}
