// Agrupar y filtrar el horario del centro por quién imparte cada franja.
//
// El profesor vive en la propia franja desde la migración 109, no se deduce
// de las asignaciones del alumno: eso es lo que permite que un alumno tenga
// el martes con María y el jueves con Pedro.
//
// Funciones puras, sin DOM: deciden QUÉ se pinta, no cómo.

export const TODOS = "__todos__";
export const SIN_ASIGNAR = "__sin_asignar__";
export const ETIQUETA_SIN_ASIGNAR = "Sin profesor asignado";

function idDe(franja) {
  return franja?.profesor?.id || franja?.profesor_id || null;
}

function nombreDe(franja) {
  return franja?.profesor?.display_name || null;
}

// Los profesores que de verdad aparecen en el horario, ordenados por nombre.
// Se sacan de las FRANJAS y no de la lista de profesores del centro a
// propósito: un profesor dado de alta pero sin ninguna clase no aporta nada
// al selector — su rejilla saldría vacía y solo añade una opción muerta.
export function profesoresConFranjas(franjas = []) {
  const porId = new Map();
  for (const f of franjas) {
    const id = idDe(f);
    if (!id) continue;
    if (!porId.has(id)) porId.set(id, { id, nombre: nombreDe(f) || "Profesor" });
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function haySinAsignar(franjas = []) {
  return franjas.some((f) => !idDe(f));
}

// Si nadie tiene profesor puesto, no hay nada que elegir: el selector no
// debe aparecer. Es el caso de una academia de una sola persona que nunca
// ha rellenado el campo, y de cualquier centro antes de la migración 109.
export function tieneSentidoElSelector(franjas = []) {
  return profesoresConFranjas(franjas).length > 0;
}

export function filtrarPorProfesor(franjas = [], seleccion) {
  if (seleccion === TODOS || !seleccion) return franjas;
  if (seleccion === SIN_ASIGNAR) return franjas.filter((f) => !idDe(f));
  return franjas.filter((f) => idDe(f) === seleccion);
}

// Grupos a pintar, en orden: un profesor por grupo y, al final, las franjas
// sin asignar. Van las últimas y no las primeras porque son la excepción,
// pero SÍ se muestran: son justamente los huecos que el admin tiene que
// resolver al cuadrar el curso, y esconderlos los convierte en invisibles.
//
// `titulo` es null cuando hay un único grupo y no hay nada que distinguir —
// una cabecera sobre una sola rejilla es ruido.
export function gruposDeHorario(franjas = [], seleccion = TODOS) {
  if (seleccion && seleccion !== TODOS) {
    return [{ id: seleccion, titulo: null, franjas: filtrarPorProfesor(franjas, seleccion) }];
  }

  const profesores = profesoresConFranjas(franjas);
  if (!profesores.length) return [{ id: TODOS, titulo: null, franjas }];

  const grupos = profesores.map((p) => ({
    id: p.id,
    titulo: p.nombre,
    franjas: franjas.filter((f) => idDe(f) === p.id),
  }));
  const sueltas = franjas.filter((f) => !idDe(f));
  if (sueltas.length) {
    grupos.push({ id: SIN_ASIGNAR, titulo: ETIQUETA_SIN_ASIGNAR, franjas: sueltas });
  }
  return grupos;
}

// Opciones del desplegable, en el orden en que se ofrecen.
export function opcionesDeProfesor(franjas = []) {
  const opciones = [{ value: TODOS, label: "Todos los profesores" }];
  for (const p of profesoresConFranjas(franjas)) opciones.push({ value: p.id, label: p.nombre });
  if (haySinAsignar(franjas)) opciones.push({ value: SIN_ASIGNAR, label: ETIQUETA_SIN_ASIGNAR });
  return opciones;
}
