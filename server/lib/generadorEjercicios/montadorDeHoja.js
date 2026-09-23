import { bateriasPropias, bateriasDeRepaso, TITULO_DE_OBJETIVO } from "./catalogoDeBaterias.js";
import { apartadosDe } from "./apartadosDeLaBateria.js";
import { alturasDe, foliosEstimados, MINIMO_ULTIMO_FOLIO_MM } from "./alturaDeLaHoja.js";
import { conEjemploResuelto } from "./ejemploResuelto.js";
import { aActividadDeHoja, solucionesDe } from "./ejercicio.js";
import { cubreConceptos } from "./cubreConceptos.js";

// EL MONTADOR: de un objetivo a una hoja.
//
// Es lo que convierte quince baterías sueltas en un folio: elige cuáles
// entran, cuántos apartados lleva cada una, en qué orden van, y devuelve la
// hoja como la espera la plantilla más las soluciones para corregir después.
//
// CUÁNTOS EJERCICIOS LO DECIDE EL ALUMNO, NO LA HOJA. Jorge, el 17/9:
// *"depende, ahí entrará el tutor: si lo lleva muy mal, bastantes ejercicios
// con explicación y ejemplos; si solo falla a veces, menos ejercicios, pero
// siempre explicación y ejemplo"*. De ahí la `intensidad`, y de ahí que
// `cuantos` no tenga valor por defecto en ninguna batería: el tamaño se
// decide aquí, con el alumno delante, y no en el generador.

// LAS TRES INTENSIDADES.
//
// LA HOJA SE MIDE EN FOLIOS, NO EN ACTIVIDADES, y este cambio viene de mirar
// el papel. Antes cada intensidad pedía un número de baterías ("normal son
// 4") y un ajuste esquivaba a mano la zona mala de la paginación. Impreso,
// fallaba por los dos lados: una hoja de refuerzo del objetivo 3 dejaba 35 mm
// en blanco, y una del objetivo 6 en modo normal sacaba un segundo folio con
// solo el pie. Un número de actividades no dice cuánto ocupan: `subraya la
// preferente` mide 67 mm y `término que falta` 34, o sea la mitad.
//
// Ahora se llena hasta `folios` sumando MILÍMETROS MEDIDOS (`alturaDeLaHoja`,
// con la tabla que escribe el script de calibración desde Chromium).
//
// `baterias` sigue existiendo como TECHO —una hoja de veinte actividades
// mínimas no es una hoja aunque quepa— pero ya no es el objetivo a rellenar.
export const INTENSIDADES = {
  // "Solo falla a veces": pocos ejercicios, los apartados mínimos. AQUÍ EL
  // TECHO SÍ MANDA y no la altura: si se dejara llenar el folio, `repaso`
  // saldría con MÁS apartados que `normal` —lo comprobé: 19 contra 15—
  // porque con apartados mínimos caben más actividades en el mismo papel.
  // Una hoja "de repaso" más larga que la normal no es una hoja de repaso.
  repaso: { folios: 1, baterias: 3, apartados: "minimo" },
  normal: { folios: 1, baterias: 6, apartados: "medio" },
  // "Lo lleva muy mal": dos caras llenas.
  refuerzo: { folios: 2, baterias: 9, apartados: "maximo" },
};

// EL REPASO ES CALENTAMIENTO, NO RELLENO.
//
// Jorge, el 18/9, sobre cuánto repaso admite una hoja de refuerzo: *"no lo
// sé, como lo veas más profesional, busca cómo se suele hacer"*. Cómo se
// suele hacer: los cuadernos de los libros de texto separan DOS fichas
// distintas, y yo las estaba mezclando en una.
//
//   · "Ficha de refuerzo de [contenido]" → es de ESE contenido. Lo que sube
//     no es la variedad de temas, es el andamiaje: ejemplo resuelto, más
//     apartados del mismo tipo, pasos más guiados.
//   · "Ficha de repaso acumulativo" → esa sí mezcla varios temas, y es OTRA
//     ficha, con su propio nombre y su propio momento (final de trimestre).
//
// Mi versión pedía 8 baterías para refuerzo y rellenaba con lo que hubiera:
// el objetivo 6 tiene 3 baterías propias, así que una hoja "de operaciones
// combinadas" salía con 5 actividades de sumar, multiplicar y potencias. Ni
// refuerza combinadas ni es un repaso acumulativo honesto.
//
// Y el argumento de "si falla en combinadas es que falla en multiplicar" es
// bueno, pero lleva a otra conclusión: entonces lo que toca es mandarle la
// hoja del objetivo 5, no una del 6 disfrazada. Esa decisión es del tutor y
// se toma eligiendo el objetivo, no diluyendo la hoja.
//
// De ahí dos límites: el repaso nunca pasa de las baterías propias y nunca
// pasa de dos actividades.
//
// HONESTAMENTE: con el catálogo de hoy es el primero el que decide, y este
// techo no llega a activarse en ninguna hoja real (se comprueba en
// `topeDeActividades`, no en la hoja montada, porque en la hoja no se
// distingue). Está escrito porque el día que `refuerzo` pida 12 baterías sí
// decidirá, y entonces el número tiene que estar puesto a conciencia y no
// salir de que casualmente no había más repaso disponible.
export const TOPE_DE_REPASO = 2;

// Cuántas actividades puede llegar a tener la hoja como MUCHO, ya con el tope
// de repaso aplicado. De ahí para abajo decide la altura medida.
export function topeDeActividades({ propias, repaso, pedidas }) {
  const dePropias = Math.min(pedidas, propias);
  const deRepaso = Math.min(repaso, pedidas - dePropias, TOPE_DE_REPASO, dePropias);
  return dePropias + deRepaso;
}

// QUÉ BATERÍAS ENTRAN. Las propias, cubriendo cada concepto del objetivo y
// en abanico por dificultad (ver cubreConceptos.js).
//
// AL RECORTAR CAE PRIMERO EL REPASO, y por eso se recalcula aquí a partir de
// `cuantas` en vez de recibirlo hecho: si la hoja no cabe y hay que bajar de 5
// a 4 actividades, lo que sobra es el calentamiento, no la batería del
// objetivo.
export function eligeBaterias({ propias, repaso = [], cuantas }) {
  const deRepaso = Math.min(
    repaso.length,
    Math.max(0, cuantas - propias.length),
    TOPE_DE_REPASO,
    propias.length,
  );
  return [...repaso.slice(0, deRepaso), ...cubreConceptos(propias, Math.max(1, cuantas - deRepaso))];
}

// LAS QUE CABEN EN LOS FOLIOS QUE SE PIDEN.
//
// Se prueba de más a menos y se devuelve la PRIMERA combinación que entra, o
// sea la más llena que cabe. Probar de menos a más daría la primera que cabe,
// que es la más vacía — y el defecto que se está arreglando es justamente el
// folio a medias.
//
// Por qué se vuelve a llamar a `eligeBaterias` en cada intento en vez de ir
// quitando de la lista: porque las que entran no son un prefijo. Con cuatro
// huecos el abanico coge la 1.ª, la 2.ª, la 4.ª y la 5.ª; con tres coge la
// 1.ª, la 3.ª y la 5.ª. Quitar la última de la lista de cuatro daría una hoja
// sin la batería más difícil del objetivo.
//
// Y NO VALE CUALQUIER FORMA DE CABER. Un último folio casi vacío es el
// defecto que `ajusteDelFolio` lleva avisando desde el principio: el objetivo
// 3 en refuerzo cabía en dos folios, sí, pero con 64 mm en el segundo — una
// cara de papel por alumno para cuatro ejercicios. Con una batería menos cabe
// entero en uno. Así que una hoja que desaprovecha el último folio solo se
// acepta si no hay ninguna más pequeña que lo evite.
//
// SI NI UNA SOLA BATERÍA CABE, se devuelve esa una igualmente: una hoja de un
// ejercicio que se sale de folio sigue siendo mejor que una hoja vacía, y el
// aviso de la vista previa lo dirá cuando exista la pantalla.
export function lasQueCaben({ propias, repaso, tope, folios, modo }) {
  let laMasLlenaQueCabe = null;
  for (let cuantas = tope; cuantas > 1; cuantas -= 1) {
    const elegidas = eligeBaterias({ propias, repaso, cuantas });
    const { folios: salen, usadoUltimoMm } = foliosEstimados(alturasDe(elegidas, modo));
    if (salen > folios) continue;
    laMasLlenaQueCabe = laMasLlenaQueCabe || elegidas;
    const desaprovecha = salen > 1 && usadoUltimoMm < MINIMO_ULTIMO_FOLIO_MM;
    if (!desaprovecha) return elegidas;
  }
  return laMasLlenaQueCabe || eligeBaterias({ propias, repaso, cuantas: 1 });
}

// CUANDO EL PROFESOR DICE CUÁNTAS. Jorge, el 23/9: *"yo no me limitaría...
// que por defecto sea como dices, pero que haya un selector de cantidad de
// ejercicios"*. Con `actividades` la hoja lleva ESE número y ocupa los
// folios que necesite: el tope de folios de la intensidad es el criterio por
// defecto, no una prohibición. La intensidad sigue decidiendo cuántos
// apartados lleva cada actividad.
//
// Lo que NO cambia son las reglas de qué entra: primero las propias, cada
// concepto antes que dos del mismo, y el repaso con su tope. Pedir 8 en el
// objetivo 4, que tiene UNA batería propia, no llena la hoja con siete de
// otros objetivos: eso sería una ficha de repaso acumulativo, que es otra
// ficha. El máximo que se puede pedir lo dice `maxActividades`.
export function maxActividades(objetivo) {
  return topeDeActividades({
    propias: bateriasPropias(objetivo).length,
    repaso: bateriasDeRepaso(objetivo).length,
    pedidas: Number.MAX_SAFE_INTEGER,
  });
}

function cuantasPidioElProfesor({ propias, repaso, actividades }) {
  const tope = topeDeActividades({ propias: propias.length, repaso: repaso.length, pedidas: actividades });
  return eligeBaterias({ propias, repaso, cuantas: Math.max(1, tope) });
}

// LOS BLOQUES: dónde cambia de tema la hoja.
//
// Jorge, el 18/9, mirando una hoja de dos folios: *"si cambia de concepto
// arranca de nuevo desde el uno... del 1 al 6 operaciones y del 1 al 2
// potencias"*. Lo de partir la hoja en bloques con su título sí; lo de
// reiniciar la numeración lo descartó él mismo al ver el coste: si hay dos
// "actividad 1" en el mismo papel, "hoja X, actividad 1, apartado c" deja de
// señalar a un solo ejercicio, y sobre eso está montado el registro de fallos.
//
// Así que el título va SOLO en la primera actividad de cada bloque y los
// números siguen corridos. El título viaja dentro de la actividad, no como
// una pieza suelta, por dos motivos que se ven en el papel: así no se puede
// quedar huérfano al final de un folio con su bloque en el siguiente, y así
// la medición de folios lo cuenta sin tener que saber que existe.
//
// CON UN SOLO BLOQUE NO SE TITULA NADA, y no es un detalle estético: un
// título de bloque existe para avisar de que la hoja cambia de tema. Si toda
// la hoja es del mismo objetivo, el título repetiría lo que ya pone la
// cabecera y gastaría cinco milímetros de folio para no decir nada.
function conTitulosDeBloque(actividades, ejercicios) {
  const objetivos = ejercicios.map((e) => e.objetivoDeLaBateria);
  if (new Set(objetivos).size < 2) return actividades;

  let anterior = null;
  return actividades.map((actividad, i) => {
    const objetivo = objetivos[i];
    if (objetivo === anterior) return actividad;
    anterior = objetivo;
    const titulo = TITULO_DE_OBJETIVO[objetivo];
    return titulo ? { ...actividad, bloque: titulo } : actividad;
  });
}

// EL AVISO DE LA HOJA ES EL QUE MANDA, y conviene decirlo aquí.
//
// Este montador elige por número de actividades, que es una buena
// aproximación pero NO una medida: dos hojas con cuatro actividades pueden
// ocupar distinto según cuántos apartados lleve cada una y cuánto espacio
// para escribir. La medida de verdad solo se puede hacer con la hoja pintada,
// y la hace `ajusteDelFolio.js` en la vista previa.
//
// Dicho de otra forma: esto acierta la zona casi siempre, y cuando no, el
// aviso de la vista previa lo dice. Lo que no se hace es afirmar aquí un
// número de folios que no se ha medido.
export function montaHoja({
  objetivo,
  azar,
  intensidad = "normal",
  conRepaso = true,
  cabecera = {},
  esencial = null,
  actividades = null,
} = {}) {
  const ajuste = INTENSIDADES[intensidad];
  if (!ajuste) throw new Error(`intensidad desconocida: ${intensidad}`);
  if (!azar) throw new Error("montaHoja necesita un generador de azar (para que la hoja se pueda repetir)");

  const propias = bateriasPropias(objetivo);
  const repaso = conRepaso ? bateriasDeRepaso(objetivo) : [];
  if (!propias.length) {
    throw new Error(`el objetivo ${objetivo} no tiene ninguna batería todavía`);
  }

  const elegidas = actividades
    ? cuantasPidioElProfesor({ propias, repaso, actividades })
    : lasQueCaben({
      propias,
      repaso,
      tope: topeDeActividades({
        propias: propias.length,
        repaso: repaso.length,
        pedidas: ajuste.baterias,
      }),
      folios: ajuste.folios,
      modo: ajuste.apartados,
    });

  const ejercicios = elegidas.map((bateria) => {
    const ejercicio = conEjemploResuelto(bateria.generador, azar, {
      cuantos: apartadosDe(bateria, ajuste.apartados),
    });
    return { ...ejercicio, objetivoDeLaBateria: bateria.objetivo, esRepaso: bateria.esRepaso };
  });

  const hoja = {
    ...cabecera,
    // LA HOJA GUARDA EL TEXTO DEL OBJETIVO, no solo su id: es la copia de lo
    // que se imprimió, y no cambia porque alguien renombre el objetivo tres
    // meses después. Misma regla que `contenido_hojas` (migración 123).
    objetivo: cabecera.objetivo || "",
    // `esencial` es CONTENIDO, no algo que este montador pueda generar: es la
    // teoría del objetivo. Viene de fuera y, cuando no viene, la hoja sale
    // sin la caja en vez de con una caja inventada.
    ...(esencial ? { esencial } : {}),
    // El bloque de ejemplo global ya no se usa: desde que cada actividad
    // lleva su apartado resuelto, uno arriba era duplicar y se comía los
    // 35 mm más valiosos del folio (los de arriba).
    ejemplos: [],
    actividades: conTitulosDeBloque(ejercicios.map(aActividadDeHoja), ejercicios),
  };

  return {
    hoja,
    // LAS SOLUCIONES NO VAN EN LA HOJA y van indexadas por el número de la
    // actividad, que es el mismo `orden` que la plantilla escribe en el DOM
    // (ver actividades.js). Es lo que permitirá corregir en papel y registrar
    // "hoja X, hueco 4, mal" sin volver a generar nada.
    soluciones: ejercicios.map((ejercicio, i) => ({
      orden: i + 1,
      clave: ejercicio.clave,
      arquetipo: ejercicio.arquetipo,
      objetivo: ejercicio.objetivoDeLaBateria,
      esRepaso: ejercicio.esRepaso,
      soluciones: solucionesDe(ejercicio),
    })),
  };
}
