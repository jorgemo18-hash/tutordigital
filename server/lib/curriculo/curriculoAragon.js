import { readFileSync } from "node:fs";
import { ETAPAS, etapaDelSlug, slugSinEtapa, slugConEtapa } from "../../../assets/shared/curriculo/etapas.js";

// EL CURRÍCULO OFICIAL DE ARAGÓN, materia a materia: competencias
// específicas, criterios de evaluación y saberes básicos por curso.
//   - ESO: ORDEN ECD/1172/2022, anexo II (aragon-eso/, 24/9/2026).
//   - Primaria: ORDEN ECD/1112/2022, anexo II, con la ECD/866/2024
//     (aragon-primaria/, 30/9/2026). Criterios y saberes van por CICLO:
//     1.º y 2.º comparten los del primer ciclo, etc.
//   - Bachillerato: ORDEN ECD/1173/2022, anexo II, con las ECD/886/2024 y
//     ECD/739/2025 (aragon-bachillerato/, 30/9/2026). Casi todas son de un
//     solo curso ("Matemáticas I", "Matemáticas II"): el curso lo da el
//     horario.
//
// Los datos se sacaron de los PDF oficiales con
// tools/curriculo/extrae_curriculo.py. Son la base de Recursos → Currículo
// y del generador de programaciones. Cada materia lleva su `calidad`: qué %
// de lo extraído está literal en el PDF y qué no, para revisarlo a mano.
//
// El slug lleva la etapa (ver assets/shared/curriculo/etapas.js). Se leen
// del disco la primera vez que se piden y se quedan en memoria.
const CARPETAS = {
  eso: new URL("./aragon-eso/", import.meta.url),
  primaria: new URL("./aragon-primaria/", import.meta.url),
  bachillerato: new URL("./aragon-bachillerato/", import.meta.url),
};
const cache = new Map();

function lee(etapa, nombre) {
  const clave = `${etapa}/${nombre}`;
  if (!cache.has(clave)) cache.set(clave, JSON.parse(readFileSync(new URL(`${nombre}.json`, CARPETAS[etapa]), "utf8")));
  return cache.get(clave);
}

// EL HORARIO SEMANAL (anexo III de cada orden), copiado a mano: por materia
// y curso. En ESO y Bachillerato son periodos lectivos; en Primaria el anexo
// da MINUTOS y aquí se guardan ya pasados a sesiones (ver su `_fuente`).
// Sirve para dos cosas: dar el curso de las materias de un solo curso (el
// anexo II no lo dice) y proponer las sesiones de una programación.
export function horario(etapa = "eso") {
  return lee(etapa, "_horario");
}

export function sesionesSemanales(slug, curso) {
  return horario(etapaDelSlug(slug))[slugSinEtapa(slug)]?.[String(curso)] ?? null;
}

export function listaDeMaterias() {
  return Object.keys(ETAPAS).flatMap((etapa) => {
    const h = horario(etapa);
    return lee(etapa, "_indice").map((m) => ({
      ...m,
      slug: slugConEtapa(etapa, m.slug),
      cursos: m.cursos.length || !h[m.slug] ? m.cursos : Object.keys(h[m.slug]).map(Number),
    }));
  });
}

export function materiaPorSlug(slug) {
  if (!/^[a-z0-9-]+$/.test(String(slug || ""))) return null;
  const etapa = etapaDelSlug(slug);
  const propio = slugSinEtapa(slug);
  if (!lee(etapa, "_indice").some((m) => m.slug === propio)) return null;
  return lee(etapa, propio);
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
    etapa: etapaDelSlug(slug),
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
