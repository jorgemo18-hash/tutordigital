// LAS UNIDADES DIDÁCTICAS DE UNA PROGRAMACIÓN: qué saberes y criterios del
// currículo lleva cada una, y qué se ha quedado sin programar.
//
// Principio de Jorge (23/9): "que de lo que se pida haya de todos". En una
// programación eso es la ley: todos los criterios y todos los saberes del
// curso tienen que estar en alguna unidad. `cobertura` lo comprueba.
//
// Funciones puras: las usan el panel (para avisar mientras se programa) y
// el servidor (para el documento). `curriculo` es lo que devuelve
// curriculoDeCurso (server/lib/curriculo/curriculoAragon.js), ya
// restringido a la variante elegida (ver `deLaVariante`).

// Un saber se identifica por su sección, su apartado y su posición: el
// texto es largo y el apartado puede no tener código (Lengua, Inglés).
export function idDeSaber(iSeccion, iBloque, iApartado, iSaber) {
  return `s${iSeccion}.${iBloque}.${iApartado}.${iSaber}`;
}

// Todos los saberes con su id, bloque y apartado, en el orden del anexo.
export function saberesConId(curriculo) {
  const lista = [];
  (curriculo?.saberes || []).forEach((sec, i) => sec.bloques.forEach((b, j) => b.apartados.forEach((a, k) => {
    a.saberes.forEach((texto, l) => {
      lista.push({ id: idDeSaber(i, j, k, l), bloque: b.bloque, apartado: a.codigo, nombreApartado: a.nombre, texto });
    });
  })));
  return lista;
}

export function criteriosDe(curriculo) {
  return (curriculo?.competencias || []).flatMap((ce) => ce.criterios.map((k) => ({ ...k, competencia: ce.codigo })));
}

// Varias secciones en un curso (Matemáticas A y B en 4.º): la programación
// es de UNA. Se quedan sus saberes y los criterios de su columna.
export function variantesDe(curriculo) {
  return (curriculo?.saberes || []).map((s) => s.etiqueta);
}

export function deLaVariante(curriculo, variante) {
  const variantes = variantesDe(curriculo);
  if (variantes.length <= 1 || !variante) return curriculo;
  const columnas = new Set(criteriosDe(curriculo).map((k) => k.columna));
  const filtraColumna = columnas.has(variante);
  return {
    ...curriculo,
    saberes: curriculo.saberes.filter((s) => s.etiqueta === variante),
    competencias: curriculo.competencias.map((ce) => ({
      ...ce,
      criterios: filtraColumna ? ce.criterios.filter((k) => k.columna === variante) : ce.criterios,
    })),
  };
}

// PROPUESTA DE PARTIDA: una unidad por bloque de saberes, con las sesiones
// repartidas según cuántos saberes tiene cada bloque, y todos los criterios
// en todas (las competencias atraviesan el curso). Es un punto de partida
// que el profesor parte, junta y ordena; no pretende ser la programación.
export function propuestaPorBloques(curriculo, { sesionesTotales = 0, trimestres = 3 } = {}) {
  const saberes = saberesConId(curriculo);
  const criterios = criteriosDe(curriculo).map((k) => k.codigo);
  const porBloque = new Map();
  for (const s of saberes) {
    const clave = s.bloque || "Saberes";
    if (!porBloque.has(clave)) porBloque.set(clave, []);
    porBloque.get(clave).push(s.id);
  }
  const bloques = [...porBloque.entries()];
  const total = saberes.length || 1;
  let asignadas = 0;
  const unidades = bloques.map(([bloque, ids], i) => {
    const sesiones = i === bloques.length - 1
      ? Math.max(0, sesionesTotales - asignadas)
      : Math.round((sesionesTotales * ids.length) / total);
    asignadas += sesiones;
    return {
      id: `u${i + 1}`,
      titulo: bloque.replace(/^[A-H]\.\s*/, ""),
      trimestre: Math.min(trimestres, 1 + Math.floor((i * trimestres) / Math.max(1, bloques.length))),
      sesiones,
      saberes: ids,
      criterios: [...criterios],
    };
  });
  return unidades;
}

// QUÉ FALTA: saberes y criterios que no están en ninguna unidad, y cómo
// cuadran las sesiones con las del curso.
export function cobertura(curriculo, unidades, { sesionesTotales = null } = {}) {
  const enUnidades = { saberes: new Set(), criterios: new Set() };
  for (const u of unidades || []) {
    (u.saberes || []).forEach((id) => enUnidades.saberes.add(id));
    (u.criterios || []).forEach((c) => enUnidades.criterios.add(c));
  }
  const saberes = saberesConId(curriculo);
  const criterios = criteriosDe(curriculo);
  const sesiones = (unidades || []).reduce((n, u) => n + (Number(u.sesiones) || 0), 0);
  return {
    saberesSinUnidad: saberes.filter((s) => !enUnidades.saberes.has(s.id)),
    criteriosSinUnidad: criterios.filter((k) => !enUnidades.criterios.has(k.codigo)),
    totalSaberes: saberes.length,
    totalCriterios: criterios.length,
    sesiones,
    sesionesTotales,
    completa: saberes.every((s) => enUnidades.saberes.has(s.id)) && criterios.every((k) => enUnidades.criterios.has(k.codigo)),
  };
}

// CRITERIOS DE CALIFICACIÓN: cuánto pesa cada cosa en la nota (en %).
// No todos los departamentos lo hacen igual, así que se elige:
//   competencia → un peso por competencia específica; sus criterios pesan
//                 lo mismo dentro de ella;
//   criterio    → un peso por cada criterio de evaluación.
// En los dos casos la nota sale de los criterios, como pide la Orden; lo
// que cambia es a qué nivel se reparte. Propuesta: a partes iguales,
// redondeado y cuadrado a 100.
export const MODOS_DE_CALIFICACION = {
  competencia: "Por competencia específica",
  criterio: "Por criterio de evaluación",
};

export function modoDeCalificacion(datos) {
  return datos?.calificacion === "criterio" ? "criterio" : "competencia";
}

function repartoIgual(codigos) {
  if (!codigos.length) return {};
  const base = Math.floor(100 / codigos.length);
  const resto = 100 - base * codigos.length;
  return Object.fromEntries(codigos.map((c, i) => [c, base + (i < resto ? 1 : 0)]));
}

export function pesosIguales(curriculo, modo = "competencia") {
  if (modo === "criterio") return repartoIgual(criteriosDe(curriculo).map((k) => k.codigo));
  return repartoIgual((curriculo?.competencias || []).filter((ce) => ce.criterios.length).map((ce) => ce.codigo));
}

// Con pesos por criterio, cuánto suma cada competencia (para el documento
// y para que el profesor vea el equilibrio).
export function pesoPorCompetencia(curriculo, pesos) {
  const suma = {};
  for (const k of criteriosDe(curriculo)) suma[k.competencia] = (suma[k.competencia] || 0) + (Number(pesos?.[k.codigo]) || 0);
  return suma;
}

export function sumaDePesos(pesos) {
  return Object.values(pesos || {}).reduce((n, v) => n + (Number(v) || 0), 0);
}
