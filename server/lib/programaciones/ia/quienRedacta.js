import { etapaDelSlug, nombreDelCurso, ETAPAS } from "../../../../assets/shared/curriculo/etapas.js";
import { referenciaDe } from "../../../../assets/shared/programacion/apartadosLegales.js";

// QUIÉN ESCRIBE LA PROGRAMACIÓN, SEGÚN LA ETAPA: la primera línea de los
// prompts de la IA (unidades y textos). En un instituto la hace el
// departamento; en un colegio, el equipo didáctico del ciclo. Si el prompt
// dijera "departamento" en Primaria, los borradores hablarían de un órgano
// que en un colegio no existe.
const QUIEN = {
  eso: { persona: "jefe de departamento", donde: "un instituto", voz: "del departamento (\"el departamento\")" },
  bachillerato: { persona: "jefe de departamento", donde: "un instituto", voz: "del departamento (\"el departamento\")" },
  primaria: { persona: "maestro o maestra", donde: "un colegio", voz: "del equipo didáctico de ciclo (\"el equipo de ciclo\")" },
};

export function quienRedacta({ materia, materiaSlug, curso }) {
  const etapa = etapaDelSlug(materiaSlug);
  const q = QUIEN[etapa];
  const de = curso ? nombreDelCurso(materiaSlug, curso).replace(/^(\d)\.º ESO$/, "$1.º de ESO") : ETAPAS[etapa].nombre;
  return {
    etapa,
    voz: q.voz,
    // "Eres jefe de departamento de Física en un instituto de Aragón y …
    // la programación didáctica de 2.º de Bachillerato".
    presentacion: (que) => `Eres ${q.persona} de ${materia} en ${q.donde} de Aragón y ${que} de ${de}`,
    // "según el artículo 59.3 de la ORDEN…" (en minúscula a media frase).
    norma: referenciaDe(materiaSlug).replace(/^A/, "a"),
  };
}
