// EL CUADRANTE EN TEXTO: días, horas y nombres, sin dibujar nada.
//
// Este archivo es el CONTRATO entre la pantalla y el papel. No sabe de DOM ni
// de pdfkit: recibe las franjas y devuelve filas y casillas ya en texto. Lo
// importan el navegador y el backend —el servidor ya importa de aquí para la
// hoja de familias (ver ocupacionHoja.js), así que el camino está abierto—, y
// por eso lo que no puede pasar es que el papel y la pantalla digan cosas
// distintas del mismo martes.
//
// Las filas y el reparto de alumnos salen de `repartirEnBloques`
// (horarioBloques.js), la MISMA función que pinta las dos rejillas de
// pantalla y que calcula la hoja de las familias. Aquí solo se decide qué
// texto lleva cada casilla.

import { etiquetaFranja, repartirEnBloques } from "./horarioBloques.js";
import { nombrePila } from "./nombrePila.js";
import { hoyYMD, textoDesde } from "./desdeFecha.js";

const NOMBRES_DIA = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
  5: "Viernes", 6: "Sábado", 7: "Domingo",
};

// Los llamadores tienen formas distintas: el cuadrante del aula ya trae
// [{value, name}] y el del centro trae [1,2,3,4,5]. Se normaliza aquí en vez
// de obligar a ninguno a cambiar la suya.
export function normalizarDias(dias = []) {
  return (dias || []).map((d) =>
    typeof d === "object" && d !== null
      ? { value: d.value, name: d.name || NOMBRES_DIA[d.value] || `Día ${d.value}` }
      : { value: d, name: NOMBRES_DIA[d] || `Día ${d}` }
  );
}

// El nombre de un alumno en el cuadrante: el de pila, como en el cuaderno.
//
// CON UNA EXCEPCIÓN QUE EN PANTALLA NO HACE FALTA: si en la misma casilla hay
// dos nombres de pila iguales, se añade la inicial del apellido ("Daniel A." /
// "Daniel E."). En pantalla se distinguen pasando el ratón por encima; en un
// folio no hay ratón, y dos "Daniel" en la misma hora es justo donde importa
// saber cuál de los dos.
export function nombresDeCelda(franjas = []) {
  const completos = franjas.map((f) => String(f?.alumno?.nombre || "").trim());
  const cuenta = new Map();
  for (const completo of completos) {
    const pila = nombrePila(completo);
    if (!cuenta.has(pila)) cuenta.set(pila, new Set());
    cuenta.get(pila).add(completo);
  }
  return completos.map((completo) => {
    const pila = nombrePila(completo) || "(sin nombre)";
    if ((cuenta.get(pila)?.size || 0) < 2) return pila;
    const inicial = completo.split(/\s+/)[1]?.[0];
    return inicial ? `${pila} ${inicial.toUpperCase()}.` : pila;
  });
}

// Las marcas entre paréntesis detrás del nombre. Son las dos cosas que, si no
// se dicen, hacen que el cuadrante mienta:
//
//   - LA HORA, cuando el alumno no ocupa la fila entera (los de "y en punto").
//     Sin ella, quien viene de 16:00 a 17:00 parece que viene de 15:30.
//   - "desde 1/10", cuando tiene la plaza pero todavía no viene. Decisión de
//     Jorge del 11/09: la plaza está comprometida —por eso sale— pero quién
//     esté hoy en el aula es otra cosa.
//
// El CURSO es opcional y viene apagado: cada "3º ESO" alarga la casilla, y en
// el papel eso se paga en cuerpo de letra (ver tablaCuadrantePdf.js, que elige
// la letra según lo que ocupa el contenido).
function marcasDe(franja, { esSuelta = false, conCurso = false, hoyISO } = {}) {
  const marcas = [];
  if (conCurso && franja?.alumno?.curso) marcas.push(franja.alumno.curso);
  if (esSuelta) marcas.push(etiquetaFranja(franja));
  const desde = textoDesde(franja?.fecha_inicio, hoyISO);
  if (desde) marcas.push(desde);
  return marcas;
}

function textoDeAlumno(franja, nombre, opciones) {
  const marcas = marcasDe(franja, opciones);
  return marcas.length ? `${nombre} (${marcas.join(", ")})` : nombre;
}

// El contenido de una casilla. Separador " / " como en la hoja de cálculo que
// Jorge lleva usando: en una casilla estrecha, las comas se confunden con las
// de un nombre compuesto.
export function textoDeCelda(celda = {}, {
  hoyISO = hoyYMD(), conCurso = false, conContador = false, maxPorFranja = 0,
} = {}) {
  const { dentro = [], sueltas = [], ocupacion = 0 } = celda;
  const nombresDentro = nombresDeCelda(dentro);
  const nombresSueltas = nombresDeCelda(sueltas);
  const partes = [
    ...dentro.map((f, i) => textoDeAlumno(f, nombresDentro[i], { hoyISO, conCurso })),
    ...sueltas.map((f, i) => textoDeAlumno(f, nombresSueltas[i], { esSuelta: true, hoyISO, conCurso })),
  ];
  const nombres = partes.join(" / ");
  if (!conContador || !nombres) return nombres;
  const total = maxPorFranja ? `${ocupacion}/${maxPorFranja}` : String(ocupacion);
  return `${total} · ${nombres}`;
}

// El modo "enseñar a una familia": plazas libres y ningún nombre. Es el mismo
// interruptor de la pantalla, y se respeta en el papel porque el caso de uso
// es precisamente imprimirlo para dárselo a alguien.
export function textoDePlazas(celda = {}, maxPorFranja = 0) {
  const { ocupacion = 0 } = celda;
  if (!maxPorFranja) return "";
  const libres = Math.max(0, maxPorFranja - ocupacion);
  if (libres === 0) return "Completo";
  return `${libres} ${libres === 1 ? "plaza" : "plazas"}`;
}

// "15:30–16:30". Las DOS horas, como en pantalla: con filas que empiezan y
// media, solo la de inicio obliga a reconstruir de cabeza dónde acaba la clase.
export function etiquetaHora(bloque) {
  return `${bloque?.inicio}–${bloque?.fin}`;
}

// UN ALUMNO DE UNA CASILLA, ya listo para escribir en una línea.
//
// Jorge, 16/09/2026, viendo el primer PDF de verdad: *"no sé, lo veo un poco
// desorganizado... o lista con los nombres, o si no es lista que salgan
// centrados y cada alumno separado por un |"*.
//
// ES UNA LÍNEA POR ALUMNO, y no es solo estética. Con todo en un párrafo
// corrido los nombres partían por donde cayera y los paréntesis con las horas
// se mezclaban con los nombres de al lado: para saber quién viene a las cinco
// había que leer la casilla entera. Y ojo, NO CUESTA SITIO: el párrafo corrido
// ya ocupaba varias líneas al partirse, solo que partía mal.
//
// `curso` a la derecha porque Jorge lo pidió —*"solo que aparezca nombre y
// curso"*— y porque con una línea por alumno ya cabe sin apretar nada.
function alumnoDeLinea(franja, nombre, { esSuelta = false, hoyISO } = {}) {
  return {
    nombre,
    curso: franja?.alumno?.curso || "",
    // La hora SOLO en los de media hora: en los demás es la de la fila y
    // repetirla veinte veces es ruido.
    hora: esSuelta ? etiquetaFranja(franja) : "",
    // "desde 1/10" para quien tiene la plaza pero aún no viene (decisión de
    // Jorge del 11/09: *"sí, que se vea"*). Va aparte y no pegado al nombre
    // para que quien dibuje pueda apagarlo en gris en vez de meterlo en el
    // texto: la plaza está comprometida, pero hoy no está en el aula.
    desde: textoDesde(franja?.fecha_inicio, hoyISO),
  };
}

// EL CONTRATO. Todo lo que hace falta para dibujar un cuadrante, sin una sola
// decisión de dibujo dentro:
//
//   { columnas: [{ value, name }],
//     filas:    [{ hora, celdas: [{ dentro: [alumno], sueltas: [alumno] }] }] }
//
// `dentro` son los de la hora entera y `sueltas` los de media hora, separados
// a propósito: en el papel van debajo de una raya de puntos, como en la
// cajita del cuadrante de pantalla. Antes iban mezclados en el mismo párrafo
// y no se distinguía quién venía a qué hora.
//
// En el modo "sin nombres" la casilla trae `texto` y ni un nombre.
export function filasDelCuadrante({
  franjas = [],
  dias = [],
  bloques = [],
  maxPorFranja = 0,
  sinNombres = false,
  hoyISO = hoyYMD(),
} = {}) {
  const columnas = normalizarDias(dias);
  if (!bloques.length || !columnas.length) return { columnas, filas: [] };

  const reparto = new Map(
    columnas.map((col) => [
      col.value,
      repartirEnBloques((franjas || []).filter((f) => f.dia_semana === col.value), bloques),
    ])
  );

  const filas = bloques.map((bloque, i) => ({
    hora: etiquetaHora(bloque),
    celdas: columnas.map((col) => {
      const celda = reparto.get(col.value)?.[i] || {};
      if (sinNombres) return { texto: textoDePlazas(celda, maxPorFranja), dentro: [], sueltas: [] };
      const dentro = celda.dentro || [];
      const sueltas = celda.sueltas || [];
      const nombresDentro = nombresDeCelda(dentro);
      const nombresSueltas = nombresDeCelda(sueltas);
      return {
        texto: "",
        dentro: dentro.map((f, j) => alumnoDeLinea(f, nombresDentro[j], { hoyISO })),
        sueltas: sueltas.map((f, j) => alumnoDeLinea(f, nombresSueltas[j], { esSuelta: true, hoyISO })),
      };
    }),
  }));

  return { columnas, filas };
}

// LAS LÍNEAS DE UNA CASILLA, ya listas para escribir: una por alumno.
//
//   { izquierda, derecha, tenue, separadorAntes }
//
// `derecha` es el curso, que se alinea a la derecha de la casilla para que la
// columna de cursos quede recta y se pueda leer en vertical.
//
// `tenue` marca a quien todavía no ha empezado: en el papel va en gris, no en
// otro tamaño ni con otra letra. Sigue estando —la plaza está comprometida—
// pero no compite con los que sí vienen hoy.
//
// `separadorAntes` es la raya de puntos que abre el bloque de los de media
// hora, como la cajita del cuadrante de pantalla. Jorge, 16/09: *"los que
// ocupan solo media hora que se vean con una línea más fina o de puntos, tipo
// el horario original"*.
export function lineasDeCelda(celda = {}) {
  if (celda.texto) return [{ izquierda: celda.texto, derecha: "", tenue: false, separadorAntes: false }];

  // EL "desde" VA EN SU PROPIA LÍNEA, debajo y sangrado. Visto en el PDF: con
  // el nombre, la hora y el "(desde 21/9)" en la misma línea, la línea se
  // partía en dos y el curso de la derecha se quedaba colgado arriba, que es
  // justo el desorden que había que quitar. Aparte, cabe siempre y se lee como
  // lo que es: una nota sobre ese alumno, no parte de su nombre.
  const lineasDeAlumno = (alumno, { separadorAntes = false } = {}) => {
    const principal = {
      izquierda: alumno.nombre,
      derecha: alumno.curso || "",
      tenue: Boolean(alumno.desde),
      separadorAntes,
    };
    // LAS NOTAS VAN DEBAJO Y SANGRADAS, nunca pegadas al nombre: su hora (los
    // de media hora) y su fecha de comienzo (los que aún no vienen). Con todo
    // en la misma línea, la línea se partía por donde caía y el curso de la
    // derecha se quedaba colgado arriba — el desorden que había que quitar.
    // Regla, y así es fácil de leer: arriba nombre y curso; debajo, las notas.
    const notas = [alumno.hora, alumno.desde].filter(Boolean).map((texto) => ({
      izquierda: texto, derecha: "", tenue: true, separadorAntes: false, sangrada: true,
    }));
    return [principal, ...notas];
  };

  const dentro = celda.dentro || [];
  const sueltas = celda.sueltas || [];
  return [
    ...dentro.flatMap((a) => lineasDeAlumno(a)),
    // La raya solo separa si hay algo ARRIBA que separar: en una casilla donde
    // únicamente hay gente de media hora, una raya en el borde superior parece
    // un error de impresión.
    ...sueltas.flatMap((a, i) => lineasDeAlumno(a, { separadorAntes: i === 0 && dentro.length > 0 })),
  ];
}
