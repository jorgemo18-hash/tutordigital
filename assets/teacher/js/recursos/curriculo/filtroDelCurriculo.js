// BUSCAR EN EL CURRÍCULO: "recta numérica", "probabilidad", "CE.M.4"…
// Sin tildes ni mayúsculas. Devuelve el mismo currículo con solo lo que
// contiene la búsqueda; una competencia se queda si ella o alguno de sus
// criterios coincide; un apartado de saberes, si él o alguna viñeta.
export function normal(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtraCurriculo(c, busqueda) {
  const q = normal(busqueda).trim();
  if (!q || !c) return c;
  const tiene = (...t) => t.some((x) => normal(x).includes(q));
  const competencias = c.competencias
    .map((ce) => {
      if (tiene(ce.codigo, ce.texto)) return ce;
      const criterios = ce.criterios.filter((k) => tiene(k.codigo, k.texto));
      return criterios.length ? { ...ce, criterios } : null;
    })
    .filter(Boolean);
  const saberes = c.saberes
    .map((s) => ({
      ...s,
      bloques: s.bloques
        .map((b) => ({
          ...b,
          apartados: b.apartados
            .map((a) => {
              if (tiene(a.codigo, a.nombre)) return a;
              const v = a.saberes.filter((x) => tiene(x));
              return v.length ? { ...a, saberes: v } : null;
            })
            .filter(Boolean),
        }))
        .filter((b) => b.apartados.length || tiene(b.bloque)),
    }))
    .filter((s) => s.bloques.length);
  return { ...c, competencias, saberes, criteriosSueltos: (c.criteriosSueltos || []).filter((k) => tiene(k.codigo, k.texto)) };
}

// La materia del currículo que corresponde a la asignatura del profesor
// ("Matemáticas" → "matematicas"; "Inglés" → "Lengua Extranjera Inglés").
export function materiaDeLaAsignatura(materias, asignatura) {
  const a = normal(asignatura).trim();
  if (!a) return null;
  const exacta = materias.find((m) => normal(m.materia) === a);
  if (exacta) return exacta.slug;
  const contiene = materias.filter((m) => normal(m.materia).includes(a) || a.includes(normal(m.materia)));
  // La más corta: "Matemáticas" antes que "Matemáticas para la toma de decisiones".
  contiene.sort((x, y) => x.materia.length - y.materia.length);
  return contiene[0]?.slug || null;
}
