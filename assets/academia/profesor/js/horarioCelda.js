import { nivelInfo } from "./nivel.js";
import { nombrePila } from "../../../shared/js/nombrePila.js";
import { buildBadgeSustitucion } from "./sustitucionBadge.js";
import { etiquetaFranja } from "../../../shared/js/horarioBloques.js";

// El dibujo de UNA casilla del cuadrante: el conteo de la esquina, los
// alumnos de la fila y la cajita de los que no ocupan la fila entera.
//
// POR QUÉ ESTÁ AQUÍ Y NO EN horario.js. Salió de allí al arreglar el conteo
// (08/09/2026), cuando el archivo pasó de las 400 líneas que permite el
// linter. La partición no es arbitraria: horario.js decide QUÉ filas y
// columnas hay y de dónde salen los datos; esto decide cómo se pinta una
// celda. Los tests del conteo entran por aquí sin montar la rejilla entera.

// La etiqueta de un alumno en el cuadrante: el CURSO ("3º ESO"), con el
// color de su etapa.
//
// Antes decía la etapa a secas ("ESO") y el curso iba en gris al lado del
// nombre. Era decir dos veces lo mismo —el color YA dice la etapa— y dejaba
// fuera el único dato que de verdad distingue a dos alumnos de ESO. Jorge,
// 03/09: "si solo pone ESO o Primaria y no el curso, no es necesaria que
// esté; mejor el curso entero, 4º PRIM, 3º ESO, 2º BACH".
//
// Sin curso no hay etiqueta: un nivel suelto no dice nada que el color no
// diga ya.
function buildCursoTag(alumno) {
  const curso = alumno?.curso;
  if (!curso) return null;
  const tag = document.createElement("span");
  tag.className = `ac-lv ${nivelInfo(alumno?.nivel).cls}`;
  tag.textContent = curso;
  return tag;
}

function buildSlot(franja) {
  const slot = document.createElement("div");
  slot.className = "ac-slot";

  const line = document.createElement("div");
  line.className = "ac-slot-line";
  const name = document.createElement("span");
  name.className = "ac-slot-name";
  // Solo el nombre de pila: en una columna de día los apellidos no caben y
  // no aportan (ver nombrePila.js). El completo se queda en el title, así
  // que basta pasar el ratón por encima para desambiguar dos Danieles.
  const completo = franja.alumno?.nombre || "";
  name.textContent = nombrePila(completo) || "(sin nombre)";
  if (completo) name.title = completo;
  line.appendChild(name);
  slot.appendChild(line);

  // .ac-slot-meta agrupa curso + sustitución a la derecha: .ac-slot solo
  // tiene 2 hijos (nombre a la izquierda, este grupo a la derecha) para
  // que justify-content:space-between siga separando exactamente esos
  // dos bloques en vez de repartir 3 huecos si el badge colgara suelto.
  const meta = document.createElement("div");
  meta.className = "ac-slot-meta";
  const cursoTag = buildCursoTag(franja.alumno);
  if (cursoTag) meta.appendChild(cursoTag);

  const badge = buildBadgeSustitucion(franja.via_sustitucion);
  if (badge) meta.appendChild(badge);
  if (meta.childElementCount) slot.appendChild(meta);

  return slot;
}

// La cajita de la esquina: los que no van de y media a y media. Lleva la
// hora delante porque es lo único que los diferencia de los de la fila —
// sin ella, un alumno de 16:00 dentro de la fila de las 15:30 sería un
// error de datos a la vista de cualquiera.
function buildSueltas(sueltas) {
  const box = document.createElement("div");
  box.className = "ac-sueltas";
  for (const franja of sueltas) {
    const item = document.createElement("div");
    item.className = "ac-suelta";
    const hora = document.createElement("span");
    hora.className = "ac-suelta-hora";
    hora.textContent = etiquetaFranja(franja);
    // El alumno va en la línea de DEBAJO de la hora, no a su derecha
    // (Jorge, 03/09): la hora es la etiqueta de la excepción y el alumno es
    // el dato, igual que en las filas normales.
    const quien = document.createElement("div");
    quien.className = "ac-suelta-quien";
    const nombre = document.createElement("span");
    nombre.className = "ac-suelta-nombre";
    const completo = franja.alumno?.nombre || "";
    nombre.textContent = nombrePila(completo) || "(sin nombre)";
    if (completo) nombre.title = completo;
    quien.appendChild(nombre);
    const cursoTag = buildCursoTag(franja.alumno);
    if (cursoTag) quien.appendChild(cursoTag);
    const badge = buildBadgeSustitucion(franja.via_sustitucion);
    if (badge) quien.appendChild(badge);
    item.append(hora, quien);
    box.appendChild(item);
  }
  return box;
}

// El contador de la esquina: cuántos hay en el hueco y cuántos caben
// ("4/6", con el máximo de Ajustes › Horario).
//
// Antes ponía "Grupo · 4" a la izquierda, que ocupa sitio para decir algo
// que el propio recuento ya dice. Y lo que de verdad interesa al mirar un
// hueco es si CABE alguien más.
//
// Los de media hora NO cuentan (Jorge, 03/09): ocupan el aula media hora,
// no el hueco entero, y sumarlos daría un "lleno" que no es verdad. Que
// están se avisa con un asterisco, explicado en la leyenda de debajo del
// cuadrante.
function buildConteo(ocupacion, sueltas, maxPorFranja) {
  const tag = document.createElement("span");
  tag.className = "ac-cell-conteo";
  const total = maxPorFranja ? `${ocupacion}/${maxPorFranja}` : String(ocupacion);
  tag.textContent = sueltas.length ? `${total}*` : total;
  if (sueltas.length) {
    tag.title = "En este hueco no están todos a la vez: el número es el momento de más gente";
  }
  return tag;
}

// CUENTA LA OCUPACIÓN REAL (el máximo por media hora), no los alumnos que
// ocupan la fila entera.
//
// EL FALLO (comprobado contra Lyceo el 08/09/2026). Este conteo decía
// `dentro.length` y marcaba con un asterisco que "además" había alumnos de
// media hora, sin decir cuántos. La hoja impresa para familias sí cuenta el
// pico (ocupacionDeBloque, ver ocupacionHoja.js), así que las dos cosas
// decían números distintos del mismo martes: **12 de las 25 casillas del
// horario real de Lyceo no coincidían**. El martes a las 16:30 la pantalla
// decía 4/6 y el papel 6, en rojo, porque de 17:00 a 17:30 había seis
// alumnos dentro. Jorge podía mirar la pantalla, ver dos huecos libres y
// prometerle plaza a una madre a la que acababa de dar un papel que decía
// que esa hora estaba llena.
//
// EL RAZONAMIENTO VIEJO ERA EL EQUIVOCADO. Decía que los de media hora "no
// ocupan el hueco entero y sumarlos daría un lleno que no es verdad" — pero
// ocupacionDeBloque no los suma a lo bruto: coge el tramo de media hora con
// más gente. Si de cinco a cinco y media hay seis personas en el aula, no
// cabe una séptima aunque a las cinco y media se marche alguien. Que es la
// pregunta que el número tiene que contestar.
//
// EL ASTERISCO SE QUEDA, pero significa otra cosa: ya no avisa de que hay
// gente sin contar (ahora está contada), sino de que la hora no es uniforme
// y el número es el pico. Sin él, un 6/6 en una hora donde a ratos hay
// cuatro se leería como "seis alumnos sentados sesenta minutos".
//
// `ocupacion` viene calculada de repartirEnBloques (horarioBloques.js), que
// es la MISMA función que usa la hoja impresa. Recalcularla aquí volvería a
// abrir la puerta a que las dos vuelvan a divergir.
function buildCell({ dentro = [], sueltas = [], ocupacion = 0 } = {}, maxPorFranja = 0) {
  const cell = document.createElement("div");
  if (!dentro.length && !sueltas.length) {
    cell.className = "ac-cell empty";
    return cell;
  }
  const completa = maxPorFranja > 0 && ocupacion >= maxPorFranja;
  cell.className = `ac-cell filled${completa ? " ac-cell--completa" : ""}`;
  cell.appendChild(buildConteo(ocupacion, sueltas, maxPorFranja));
  // Los alumnos del hueco van en su propio contenedor para poder ponerlos
  // a DOS COLUMNAS cuando la celda es ancha (ver .ac-slots en el CSS): en
  // el panel de profesor una columna de día mide ~350px y caben dos por
  // línea, con lo que el cuadrante ocupa la mitad de alto. En "Dar clase",
  // con el menú lateral, mide ~150px y van en una sola.
  if (dentro.length) {
    const lista = document.createElement("div");
    lista.className = "ac-slots";
    for (const franja of dentro) lista.appendChild(buildSlot(franja));
    cell.appendChild(lista);
  }
  if (sueltas.length) cell.appendChild(buildSueltas(sueltas));
  return cell;
}


export { buildCell };
