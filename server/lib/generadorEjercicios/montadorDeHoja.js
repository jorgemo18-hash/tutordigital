import { bateriasPropias, bateriasDeRepaso } from "./catalogoDeBaterias.js";
import { conEjemploResuelto } from "./ejemploResuelto.js";
import { aActividadDeHoja, solucionesDe } from "./ejercicio.js";

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
// El número de baterías no está elegido a ojo: sale de medir el folio con
// Chrome (ver tests/manual/paginacionContraChrome.mjs). Hasta 4 actividades
// caben en un folio; de 5 a 6 se gasta un segundo folio para poner casi nada;
// de 7 a 9 los dos folios salen aprovechados.
export const INTENSIDADES = {
  // "Solo falla a veces": una cara, los apartados mínimos de cada arquetipo.
  repaso: { baterias: 3, apartados: "minimo" },
  normal: { baterias: 4, apartados: "medio" },
  // "Lo lleva muy mal": dos caras llenas. `baterias` es un TECHO, no un
  // objetivo a rellenar: si el objetivo solo tiene tres baterías propias, la
  // hoja sale con tres (más el calentamiento) y la intensidad la ponen los
  // apartados. Ver `TOPE_DE_REPASO`.
  refuerzo: { baterias: 8, apartados: "maximo" },
};

// ESQUIVA LA ZONA MALA DE LA PAGINACIÓN.
//
// No es un ajuste cosmético: 5 o 6 actividades sacan un segundo folio con 48
// o 92 mm de contenido, o sea una cara de papel casi vacía por alumno. Con 4
// cabe todo en una cara y con 7 el segundo folio ya se aprovecha.
//
// Se recorta hacia ABAJO y no hacia arriba porque subir a 7 exigiría baterías
// que a lo mejor no existen: el objetivo 4 tiene UNA.
export function ajustaALaZonaBuena(cuantas) {
  if (cuantas <= 4) return cuantas;
  if (cuantas <= 6) return 4;
  return Math.min(cuantas, 9);
}

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

// Cuántas actividades puede llegar a tener la hoja, ya con el tope aplicado.
// Se calcula ANTES de esquivar la zona mala porque el número que hay que
// esquivar es el final, no el pedido.
export function topeDeActividades({ propias, repaso, pedidas }) {
  const dePropias = Math.min(pedidas, propias);
  const deRepaso = Math.min(repaso, pedidas - dePropias, TOPE_DE_REPASO, dePropias);
  return dePropias + deRepaso;
}

// QUÉ BATERÍAS ENTRAN.
//
// La primera versión cogía las últimas de la lista, y estaba mal de una
// manera que solo se ve mirando el resultado: para una hoja de repaso del
// objetivo 3 elegía las tres últimas —resta con paréntesis, término que falta
// y cadena— y tiraba `sumaMismoSigno` y `sumaDistintoSigno`, que son LA BASE
// del objetivo. Una hoja de sumar y restar enteros sin sumar dos del mismo
// signo no es una hoja de ese objetivo.
//
// Lo que hace falta es un ABANICO: repartir las que entran a lo largo de la
// secuencia de dificultad, cogiendo siempre la primera y la última. Así una
// hoja de tres actividades lleva la base, una intermedia y la más difícil, en
// vez de tres variantes del mismo nivel.
//
// AL RECORTAR CAE PRIMERO EL REPASO, y por eso se recalcula aquí a partir de
// `cuantas` en vez de recibirlo hecho: si la zona mala obliga a bajar de 5 a
// 4 actividades, lo que sobra es el calentamiento, no la batería del objetivo.
export function eligeBaterias({ propias, repaso = [], cuantas }) {
  const deRepaso = Math.min(
    repaso.length,
    Math.max(0, cuantas - propias.length),
    TOPE_DE_REPASO,
    propias.length,
  );
  return [...repaso.slice(0, deRepaso), ...enAbanico(propias, cuantas - deRepaso)];
}

// Reparte `cuantas` posiciones a lo largo de la lista, incluyendo los dos
// extremos. Con 5 baterías y 3 huecos: la 1.ª, la 3.ª y la 5.ª.
function enAbanico(lista, cuantas) {
  if (cuantas >= lista.length) return [...lista];
  // Con una sola, la del objetivo: la última es la que más lo representa.
  if (cuantas <= 1) return [lista[lista.length - 1]];
  const paso = (lista.length - 1) / (cuantas - 1);
  return Array.from({ length: cuantas }, (_, i) => lista[Math.round(i * paso)]);
}

// Cuántos apartados pedirle a una batería, dentro del rango de su arquetipo.
// Nunca por debajo del mínimo: ese número está en la instrucción del
// arquetipo y bajarlo rompe lo que la batería pretende cubrir (los cuatro
// casos de signos no caben en tres apartados).
function apartadosDe(bateria, modo) {
  if (modo === "minimo") return bateria.minimo;
  if (modo === "maximo") return bateria.maximo;
  return Math.round((bateria.minimo + bateria.maximo) / 2);
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
} = {}) {
  const ajuste = INTENSIDADES[intensidad];
  if (!ajuste) throw new Error(`intensidad desconocida: ${intensidad}`);
  if (!azar) throw new Error("montaHoja necesita un generador de azar (para que la hoja se pueda repetir)");

  const propias = bateriasPropias(objetivo);
  const repaso = conRepaso ? bateriasDeRepaso(objetivo) : [];
  if (!propias.length) {
    throw new Error(`el objetivo ${objetivo} no tiene ninguna batería todavía`);
  }

  const cuantas = ajustaALaZonaBuena(topeDeActividades({
    propias: propias.length,
    repaso: repaso.length,
    pedidas: ajuste.baterias,
  }));
  const elegidas = eligeBaterias({ propias, repaso, cuantas });

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
    actividades: ejercicios.map(aActividadDeHoja),
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
