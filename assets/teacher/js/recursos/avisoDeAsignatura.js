// "TODAVÍA NO HAY HOJAS DE MÚSICA". Jorge, 23/9: con el grupo de Música
// elegido, Recursos le ofrecía la hoja de números enteros sin más.
//
// Hoy el generador solo tiene un tema (Matemáticas, 1.º ESO, enteros). No se
// esconde: un profesor puede querer verlo. Pero si la asignatura que tiene
// elegida no está en el catálogo, se le dice, con lo que sí hay. Cuando
// entren más temas, el aviso desaparece solo para esas asignaturas.
const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function textoDelAviso({ asignatura, catalogo }) {
  if (!asignatura || !catalogo?.temas?.length) return null;
  const materias = new Set(catalogo.temas.map((t) => normal(t.materia)));
  if (materias.has(normal(asignatura))) return null;
  const hay = catalogo.temas.map((t) => `${t.materia} de ${t.curso} (${t.nombre})`).join(", ");
  return `Todavía no hay hojas de ejercicios de ${asignatura}. De momento el generador solo tiene ${hay}; puedes usarlo igualmente.`;
}
