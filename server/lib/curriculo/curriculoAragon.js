import { readFileSync } from "node:fs";

// EL CURRÍCULO OFICIAL DE ESO DE ARAGÓN (ORDEN ECD/1172/2022, anexo II),
// materia a materia: competencias específicas, criterios de evaluación y
// saberes básicos por curso.
//
// Los datos se sacaron de los PDF oficiales con
// tools/curriculo/extrae_curriculo.py (24/9/2026) y están en
// aragon-eso/*.json. Son la base de Recursos → Currículo y, después, del
// generador de programaciones. Cada materia lleva su `calidad`: qué % de
// lo extraído está literal en el PDF y qué no, para revisarlo a mano.
//
// Se leen del disco la primera vez que se piden y se quedan en memoria:
// 1,3 MB en total, y la mayoría de peticiones piden una o dos materias.
const CARPETA = new URL("./aragon-eso/", import.meta.url);
const cache = new Map();

function lee(nombre) {
  if (!cache.has(nombre)) cache.set(nombre, JSON.parse(readFileSync(new URL(`${nombre}.json`, CARPETA), "utf8")));
  return cache.get(nombre);
}

// EL HORARIO SEMANAL MÍNIMO (anexo III), copiado a mano: periodos por
// semana de cada materia en cada curso. Sirve para dos cosas: dar el curso
// de las materias de un solo curso (el anexo II no lo dice) y proponer las
// sesiones de una programación.
export function horario() {
  return lee("_horario");
}

export function sesionesSemanales(slug, curso) {
  return horario()[slug]?.[String(curso)] ?? null;
}

export function listaDeMaterias() {
  const h = horario();
  return lee("_indice").map((m) => (m.cursos.length || !h[m.slug]
    ? m
    : { ...m, cursos: Object.keys(h[m.slug]).map(Number) }));
}

export function materiaPorSlug(slug) {
  if (!/^[a-z0-9-]+$/.test(String(slug || ""))) return null;
  if (!lee("_indice").some((m) => m.slug === slug)) return null;
  return lee(slug);
}

// Una materia para un curso. `cursos: []` en el anexo quiere decir que no
// lo dice (materias de un solo curso): entonces vale para cualquiera.
const valePara = (cursos, curso) => !curso || !cursos?.length || cursos.includes(curso);

export function curriculoDeCurso(slug, curso = null) {
  const m = materiaPorSlug(slug);
  if (!m) return null;
  const criterios = m.criterios.filter((c) => valePara(c.cursos, curso));
  const competencias = m.competencias.map((ce) => ({
    codigo: ce.codigo,
    // Sin enunciado: el PDF no dejó leerlo (se dice en la pantalla).
    texto: ce.texto || "",
    criterios: criterios
      .filter((c) => c.competencia === ce.codigo)
      .map(({ codigo, texto, columna }) => ({ codigo, texto, columna })),
  }));
  const saberes = m.saberes
    .filter((s) => valePara(s.cursos, curso))
    .map(({ etiqueta, cursos, bloques }) => ({ etiqueta, cursos, bloques }));
  return {
    materia: m.materia,
    curso,
    fuente: m.fuente,
    competencias,
    // Criterios cuya competencia no se pudo leer: se enseñan aparte, no se
    // pierden.
    criteriosSueltos: criterios.filter((c) => !m.competencias.some((ce) => ce.codigo === c.competencia)),
    saberes,
    sesionesSemanales: curso ? sesionesSemanales(slug, curso) : null,
    literal: m.calidad?.literal ?? null,
  };
}
