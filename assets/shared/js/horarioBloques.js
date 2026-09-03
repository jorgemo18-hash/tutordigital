import { toMinutos, toHHMM } from "./horarioFranjas.js";
import { PASO_MIN, tramosApertura, tramosDe } from "./horarioTramos.js";

// La rejilla como el cuaderno de Jorge: una fila por CLASE, no por media
// hora.
//
// EL PROBLEMA. Desde que la rejilla se dibuja en tramos de media hora (ver
// horarioTramos.js) el cuadrante de Lyceo tiene diez filas para cinco
// clases, y cada alumno aparece dos veces —a las 15:30 y a las 16:00— por
// una clase de una hora. Es correcto y es ilegible: al mirarlo no se sabe
// cuántas clases hay, y todo parece el doble de lleno de lo que está.
//
// LO QUE HACE UN PROFESOR EN PAPEL. Una columna por día, una fila por
// clase (aquí de y media a y media), y el alumno que viene a una hora
// distinta —de en punto a en punto— metido en una cajita a caballo entre
// dos filas. Así lleva Jorge el cuaderno con Rakel. Es la misma
// información sin la mitad del ruido.
//
// LA REGLA, en dos líneas:
//   - las FILAS son las clases estándar del centro: franja_duracion desde
//     la apertura (15:30-16:30, 16:30-17:30…);
//   - una franja va en la fila si la cubre ENTERA. Si no cubre ninguna
//     (16:00-17:00, 17:00-17:30), va a la cajita de la fila donde empieza,
//     con su hora escrita.
//
// Verificado contra Lyceo (02/09, 48 franjas vigentes): 42 caen en fila —
// 15:30, 16:30, 17:30 y 18:30, todas de y media a y media— y 6 van a la
// cajita: las de 16:00 y 17:00. Exactamente el reparto del cuaderno.
//
// NO sustituye a los tramos de media hora: la OCUPACIÓN (plazas libres)
// se sigue contando por tramo, porque quien viene de 16:00 a 17:00 y quien
// viene de 16:30 a 17:30 comparten el aula media hora y por bloque no se
// verían. Aquí los bloques solo deciden cómo se DIBUJA.

// Las filas: clases de `franja_duracion` desde cada apertura (una, o dos
// con jornada partida). Si al final del tramo sobra un resto de al menos
// media hora —abre hasta las 20:00 con clases de una hora empezando y
// media— se añade como fila corta en vez de tirarlo: ahí caben clases.
// Si los dos tramos de una jornada partida se solapan (un dedazo en
// Ajustes: 15:30-20:30 y 16:00-21:00), la fila aparece UNA vez y en orden,
// en vez de dibujar el cuadrante dos veces montado sobre sí mismo. Mismo
// criterio que filasDeRejillaDeConfig, que ya lo hacía.
export function bloquesDeConfig(config = {}, paso = PASO_MIN) {
  const duracion = Math.max(paso, Number(config?.franja_duracion) || 60);
  const porInicio = new Map();
  for (const [aperturaInicio, aperturaFin] of tramosApertura(config)) {
    const cierre = toMinutos(aperturaFin);
    let t = toMinutos(aperturaInicio);
    while (cierre - t >= paso) {
      const fin = Math.min(t + duracion, cierre);
      if (!porInicio.has(t)) porInicio.set(t, { inicio: toHHMM(t), fin: toHHMM(fin) });
      t = fin;
    }
  }
  return [...porInicio.entries()].sort((a, b) => a[0] - b[0]).map(([, bloque]) => bloque);
}

// ¿La franja cubre este bloque entero? Entonces es una clase de esa fila y
// se pinta como siempre. Una clase de dos horas cubre DOS bloques y sale en
// los dos: es donde está el alumno, no una duplicación.
function cubre(franja, bloque) {
  return (
    toMinutos(franja?.hora_inicio) <= toMinutos(bloque.inicio) &&
    toMinutos(franja?.hora_fin || franja?.hora_inicio) >= toMinutos(bloque.fin)
  );
}

// El bloque donde EMPIEZA una franja que no cubre ninguno. Si empieza antes
// de abrir o después de cerrar (una franja vieja, un horario que se cambió
// en Ajustes y dejó clases fuera) se agarra al primero o al último: una
// clase que no se pinta en ningún sitio es una clase que se olvida.
function bloqueDeInicio(franja, bloques) {
  const inicio = toMinutos(franja?.hora_inicio);
  const indice = bloques.findIndex((b) => inicio >= toMinutos(b.inicio) && inicio < toMinutos(b.fin));
  if (indice !== -1) return indice;
  return inicio < toMinutos(bloques[0].inicio) ? 0 : bloques.length - 1;
}

// Cuántos alumnos hay A LA VEZ en algún momento del bloque. No es "cuántas
// franjas lo tocan": dos clases de media hora seguidas no llenan el aula,
// y contarlas juntas daría un "6/6" falso. Se mira tramo a tramo y se
// devuelve el peor, que es lo que decide si cabe alguien más.
export function ocupacionDeBloque(franjas, bloque, paso = PASO_MIN) {
  const porTramo = new Map();
  for (const f of franjas || []) {
    for (const tramo of tramosDe(f?.hora_inicio, f?.hora_fin, paso)) {
      if (tramo >= bloque.fin || tramo < bloque.inicio) continue;
      porTramo.set(tramo, (porTramo.get(tramo) || 0) + 1);
    }
  }
  return porTramo.size ? Math.max(...porTramo.values()) : 0;
}

// Reparte las franjas de UN día en las filas: `dentro` (clases de la fila)
// y `sueltas` (las de la cajita). Devuelve una entrada por bloque, en
// orden, para que el que pinta no tenga que buscar nada.
export function repartirEnBloques(franjas, bloques, paso = PASO_MIN) {
  const reparto = bloques.map((bloque) => ({ bloque, dentro: [], sueltas: [], ocupacion: 0 }));
  if (!bloques.length) return reparto;

  for (const franja of franjas || []) {
    const cubiertos = reparto.filter((r) => cubre(franja, r.bloque));
    if (cubiertos.length) {
      for (const r of cubiertos) r.dentro.push(franja);
    } else {
      reparto[bloqueDeInicio(franja, bloques)].sueltas.push(franja);
    }
  }

  for (const r of reparto) r.ocupacion = ocupacionDeBloque(franjas, r.bloque, paso);
  return reparto;
}

// "15:30 – 16:30". La etiqueta de la fila lleva las DOS horas a propósito:
// con solo la de inicio, y filas que empiezan y media, hay que reconstruir
// mentalmente dónde acaba cada clase — que es justo lo que se veía mal.
export function etiquetaBloque(bloque) {
  return `${bloque.inicio} – ${bloque.fin}`;
}

// "16:00 – 17:00", para la cajita: ahí la hora es el dato que importa,
// porque es lo que la hace distinta de la fila donde está.
export function etiquetaFranja(franja) {
  const inicio = String(franja?.hora_inicio || "").slice(0, 5);
  const fin = String(franja?.hora_fin || "").slice(0, 5);
  return fin ? `${inicio} – ${fin}` : inicio;
}
