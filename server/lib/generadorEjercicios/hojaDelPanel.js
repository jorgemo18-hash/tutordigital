import { randomBytes } from "node:crypto";
import { crearAzar } from "./aleatorio.js";
import { montaHoja, maxActividades, INTENSIDADES } from "./montadorDeHoja.js";
import { TITULO_DE_OBJETIVO, bateriasPropias, bateriasDeRepaso } from "./catalogoDeBaterias.js";
import { apartadosDe } from "./apartadosDeLaBateria.js";
import { conEjemploResuelto } from "./ejemploResuelto.js";
import { aActividadDeHoja } from "./ejercicio.js";
import { TEMAS_CON_GENERADOR, temaPorId } from "./temasConGenerador.js";

// LA HOJA TAL COMO LA PIDE EL PANEL DE LA ACADEMIA (sección "Ejercicios").
//
// Separado de la ruta para poder probarlo sin servidor: qué se ofrece, qué
// cabecera lleva, que LA MISMA SEMILLA DA LA MISMA HOJA, y el cambio de un
// ejercicio suelto sin rehacer la hoja.

// El nombre de cada batería es el de su arquetipo (lo que un profesor
// reconoce: "Completa con el signo > o <"). El generador lo escribe al
// generar, así que se genera una vez con una semilla fija para leerlo.
function nombreDeBateria(bateria) {
  return bateria.generador(crearAzar("nombre"), { cuantos: bateria.minimo }).arquetipo;
}

let catalogoEnCache = null;

export function catalogoDelPanel() {
  if (!catalogoEnCache) {
    catalogoEnCache = {
      temas: TEMAS_CON_GENERADOR.map((tema) => ({
        id: tema.id,
        curso: tema.curso,
        materia: tema.materia,
        nombre: tema.nombre,
        // `maxActividades`: hasta cuántas se pueden pedir (ver
        // montadorDeHoja.js). `baterias`: las que se ofrecen al cambiar un
        // ejercicio por "uno en concreto".
        objetivos: tema.objetivos.map((numero) => ({
          numero,
          titulo: TITULO_DE_OBJETIVO[numero],
          maxActividades: maxActividades(numero),
          baterias: bateriasPropias(numero).map((b) => ({
            clave: b.clave, nombre: nombreDeBateria(b), dificultad: b.dificultad,
          })),
        })),
      })),
      intensidades: Object.keys(INTENSIDADES),
    };
  }
  return catalogoEnCache;
}

export function semillaNueva() {
  return randomBytes(6).toString("hex");
}

function cabeceraDe(tema, objetivo) {
  return { materia: tema.materia, curso: tema.curso, tema: tema.nombre, objetivo: TITULO_DE_OBJETIVO[objetivo] };
}

// La hoja entera. Devuelve también los HUECOS: qué batería hay en cada
// actividad, que es lo que el panel necesita para cambiar una sola.
// `actividades`: cuántas pidió el profesor, o nada para "automático".
export function hojaDelPanel({ temaId, objetivo, intensidad, semilla, actividades = null }) {
  const tema = temaPorId(temaId);
  if (!tema) throw new Error(`tema sin generador: ${temaId}`);
  const { hoja, soluciones } = montaHoja({
    objetivo,
    intensidad,
    actividades,
    azar: crearAzar(`${objetivo}-${intensidad}-${actividades || "auto"}-${semilla}`),
    cabecera: cabeceraDe(tema, objetivo),
  });
  const huecos = soluciones.map(({ orden, clave, objetivo: o, esRepaso }) => ({ orden, clave, objetivo: o, esRepaso }));
  return { hoja, huecos };
}

// UN EJERCICIO SUELTO, para cambiar uno de la hoja sin rehacer los demás.
// Jorge, 16/9 y 23/9: descartar un ejercicio concreto y elegir "otro
// parecido" (la misma batería con otros números) o "uno en concreto" (otra
// batería del objetivo).
//
// Solo baterías del objetivo pedido o de su repaso: cambiar un ejercicio de
// la hoja de enteros por uno de otro tema no es cambiar un ejercicio, es otra
// hoja. Lleva su ejemplo resuelto y los apartados de la intensidad, igual que
// al montar la hoja.
export function actividadDelPanel({ temaId, objetivo, intensidad, clave, semilla }) {
  if (!temaPorId(temaId)) throw new Error(`tema sin generador: ${temaId}`);
  const bateria = [...bateriasPropias(objetivo), ...bateriasDeRepaso(objetivo)].find((b) => b.clave === clave);
  if (!bateria) return null;
  const ejercicio = conEjemploResuelto(bateria.generador, crearAzar(`${clave}-${semilla}`), {
    cuantos: apartadosDe(bateria, INTENSIDADES[intensidad].apartados),
  });
  return {
    actividad: aActividadDeHoja(ejercicio),
    hueco: { clave, objetivo: bateria.objetivo, esRepaso: bateria.esRepaso },
  };
}
