export const CURSOS = [
  "1º PRIM", "2º PRIM", "3º PRIM", "4º PRIM", "5º PRIM", "6º PRIM",
  "1º ESO", "2º ESO", "3º ESO", "4º ESO",
  "1º BACH", "2º BACH",
];

// Espejo de server/lib/academiaAlumnoHelpers.js#nivelDeCurso — el backend
// vuelve a derivarlo de todos modos, esto es solo para la UI (badge en vivo).
export function nivelDeCurso(curso) {
  const c = String(curso || "");
  if (c.includes("PRIM")) return "primaria";
  if (c.includes("ESO")) return "eso";
  if (c.includes("BACH")) return "bachillerato";
  return null;
}

const NIVEL_INFO = {
  primaria: { cls: "pri", label: "PRIMARIA" },
  eso: { cls: "eso", label: "ESO" },
  bachillerato: { cls: "bach", label: "BACHILLER" },
};

export function nivelInfo(nivel) {
  return NIVEL_INFO[nivel] || { cls: "eso", label: "—" };
}
