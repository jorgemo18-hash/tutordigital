// LAS TRES ETAPAS DEL CURRÍCULO DE ARAGÓN: Primaria, ESO y Bachillerato.
//
// UNA MATERIA SE IDENTIFICA POR SU SLUG, y el slug dice la etapa:
//   "matematicas"               → Matemáticas de ESO (como hasta ahora: las
//                                 programaciones ya guardadas no cambian);
//   "primaria-matematicas"      → Matemáticas de Primaria;
//   "bachillerato-matematicas-i"→ Matemáticas I de Bachillerato.
// Así una programación sigue siendo "materia + curso", sin columna nueva:
// "Matemáticas 1.º" de ESO y de Primaria no se pueden confundir.
//
// Lo importan el servidor (qué carpeta leer) y el panel (cómo se llama el
// curso): si cada uno lo dedujera a su manera, dirían cosas distintas.
export const ETAPAS = {
  primaria: { prefijo: "primaria-", nombre: "Primaria", cursos: [1, 2, 3, 4, 5, 6] },
  eso: { prefijo: "", nombre: "ESO", cursos: [1, 2, 3, 4] },
  bachillerato: { prefijo: "bachillerato-", nombre: "Bachillerato", cursos: [1, 2] },
};

export function etapaDelSlug(slug) {
  const s = String(slug || "");
  if (s.startsWith(ETAPAS.primaria.prefijo)) return "primaria";
  if (s.startsWith(ETAPAS.bachillerato.prefijo)) return "bachillerato";
  return "eso";
}

// El slug dentro de su carpeta ("primaria-matematicas" → "matematicas").
export function slugSinEtapa(slug) {
  return String(slug || "").slice(ETAPAS[etapaDelSlug(slug)].prefijo.length);
}

export function slugConEtapa(etapa, slug) {
  return `${ETAPAS[etapa].prefijo}${slug}`;
}

export function cursoValido(etapa, curso) {
  return ETAPAS[etapa]?.cursos.includes(curso) ?? false;
}

// "3.º de Primaria", "1.º de Bachillerato", "2.º ESO" (como ya salía).
export function nombreDelCurso(slug, curso) {
  if (!curso) return "";
  const etapa = etapaDelSlug(slug);
  return etapa === "eso" ? `${curso}.º ESO` : `${curso}.º de ${ETAPAS[etapa].nombre}`;
}
