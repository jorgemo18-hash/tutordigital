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

// EL CONTRATO. Todo lo que hace falta para dibujar un cuadrante, sin una sola
// decisión de dibujo dentro:
//
//   { columnas: [{ value, name }],
//     filas:    [{ hora, celdas: ["Alex / Daniel", "", …] }] }
//
// Quien lo pinte —el navegador o pdfkit— solo tiene que colocar cajas.
export function filasDelCuadrante({
  franjas = [],
  dias = [],
  bloques = [],
  maxPorFranja = 0,
  sinNombres = false,
  conCurso = false,
  conContador = false,
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
      return sinNombres
        ? textoDePlazas(celda, maxPorFranja)
        : textoDeCelda(celda, { hoyISO, conCurso, conContador, maxPorFranja });
    }),
  }));

  return { columnas, filas };
}
