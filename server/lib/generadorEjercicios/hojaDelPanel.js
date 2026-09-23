import { randomBytes } from "node:crypto";
import { crearAzar } from "./aleatorio.js";
import { montaHoja, maxActividades, INTENSIDADES } from "./montadorDeHoja.js";
import { TITULO_DE_OBJETIVO, bateriasPropias, bateriasDeRepaso } from "./catalogoDeBaterias.js";
import { apartadosDe } from "./apartadosDeLaBateria.js";
import { conEjemploResuelto } from "./ejemploResuelto.js";
import { aActividadDeHoja } from "./ejercicio.js";
import { TEMAS_CON_GENERADOR, temaPorId } from "./temasConGenerador.js";
import { nombreDelConcepto } from "./conceptosDelTema.js";

// LA HOJA TAL COMO LA PIDE EL PANEL DE LA ACADEMIA (sección "Ejercicios").
//
// Separado de la ruta para poder probarlo sin servidor: qué se ofrece, qué
// cabecera lleva, que LA MISMA SEMILLA DA LA MISMA HOJA, y el cambio de un
// ejercicio suelto sin rehacer la hoja.

// El nombre de cada batería es el de su arquetipo (lo que un profesor
// reconoce: "Completa con el signo > o <"). El generador lo escribe al
// generar, así que se genera una vez con una semilla fija para leerlo.
const nombres = new Map();
function nombreDeBateria(bateria) {
  if (!nombres.has(bateria.clave)) {
    nombres.set(bateria.clave, bateria.generador(crearAzar("nombre"), { cuantos: bateria.minimo }).arquetipo);
  }
  return nombres.get(bateria.clave);
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

// LO QUE LA PANTALLA ENSEÑA DE CADA EJERCICIO, además de la batería: su
// nombre, su dificultad (1-3) y el concepto que trabaja. Es la fila de la
// lista de ejercicios del diseño. Todo sale del catálogo; nada se estima.
function datosDelHueco(temaId, { clave, objetivo, esRepaso }) {
  const bateria = bateriasPropias(objetivo).find((b) => b.clave === clave);
  return {
    clave,
    objetivo,
    esRepaso,
    nombre: bateria ? nombreDeBateria(bateria) : clave,
    dificultad: bateria?.dificultad ?? null,
    concepto: bateria ? nombreDelConcepto(temaId, bateria.concepto) : null,
  };
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
// `baterias`: claves concretas pedidas en palabras (ver interpretePedido.js).
export function hojaDelPanel({ temaId, objetivo, intensidad, semilla, actividades = null, baterias = null }) {
  const tema = temaPorId(temaId);
  if (!tema) throw new Error(`tema sin generador: ${temaId}`);
  const { hoja, soluciones } = montaHoja({
    objetivo,
    intensidad,
    actividades,
    baterias,
    azar: crearAzar(`${objetivo}-${intensidad}-${baterias?.join(",") || actividades || "auto"}-${semilla}`),
    cabecera: cabeceraDe(tema, objetivo),
  });
  const huecos = soluciones.map(({ orden, clave, objetivo: o, esRepaso }) => ({
    orden, ...datosDelHueco(temaId, { clave, objetivo: o, esRepaso }),
  }));
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
    hueco: datosDelHueco(temaId, { clave, objetivo: bateria.objetivo, esRepaso: bateria.esRepaso }),
  };
}
