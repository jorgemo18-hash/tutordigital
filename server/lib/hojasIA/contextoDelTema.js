import { curriculoDeCurso } from "../curriculo/curriculoAragon.js";
import { slugConEtapa, nombreDelCurso } from "../../../assets/shared/curriculo/etapas.js";
import { referenciasDelTema } from "../ejerciciosReferencia/referencias.js";
import { apartadosDeSaberes } from "../ejerciciosReferencia/saberesDelArchivo.js";

// LO QUE LA IA NECESITA SABER DE UN TEMA para escribir una hoja: la materia y
// el curso, los saberes del currículo de Aragón que trabaja el tema (con su
// texto LITERAL, no un resumen) y unos ejercicios de referencia de ese tema.
//
// Las referencias se eligen con variedad de tipos (uno de cada tipo por
// vuelta) y en orden de dificultad: diez del mismo tipo le enseñarían a la
// IA a hacer diez del mismo tipo.
export const REFERENCIAS_EN_EL_PROMPT = 12;

function variadas(ejercicios, max) {
  const porTipo = new Map();
  for (const e of [...ejercicios].sort((a, b) => a.dificultad - b.dificultad)) {
    porTipo.set(e.tipo, [...(porTipo.get(e.tipo) || []), e]);
  }
  const elegidos = [];
  for (let vuelta = 0; elegidos.length < Math.min(max, ejercicios.length); vuelta += 1) {
    for (const lista of porTipo.values()) if (lista[vuelta] && elegidos.length < max) elegidos.push(lista[vuelta]);
  }
  return elegidos;
}

export function contextoDelTema({ etapa, materia, curso, tema }) {
  const datos = referenciasDelTema({ etapa, materia, curso, tema });
  if (!datos) return null;
  const slug = slugConEtapa(etapa, materia);
  const curriculo = curriculoDeCurso(slug, curso);
  // En 4.º ESO, los de su opción (A o B): los códigos se repiten.
  const apartados = apartadosDeSaberes(curriculo, datos.opcion);
  const saberes = datos.saberes.map((codigo) => {
    const a = apartados.find((x) => x.codigo === codigo);
    return { codigo, nombre: a?.nombre || "", textos: a?.saberes || [] };
  });
  return {
    materia: curriculo?.materia || materia,
    materiaSlug: slug,
    curso: nombreDelCurso(slug, curso),
    tema: datos.titulo,
    saberes,
    referencias: variadas(datos.ejercicios, REFERENCIAS_EN_EL_PROMPT),
    // Todas, para comprobar que lo que escribe la IA no es una copia.
    todasLasReferencias: datos.ejercicios,
  };
}
