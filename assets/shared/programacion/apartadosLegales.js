// LO QUE TIENE QUE LLEVAR UNA PROGRAMACIÓN DIDÁCTICA EN ARAGÓN, por etapa.
// Texto literal del BOA, en su orden y con su letra: es lo que Inspección
// va a buscar, y el generador de programaciones sigue exactamente este
// índice.
//   - ESO: artículo 59.3 de la ORDEN ECD/1172/2022 (BOA núm. 156,
//     11/08/2022). La ECD/867/2024 no lo toca.
//   - Primaria: artículo 42.3 de la ORDEN ECD/1112/2022 (BOA núm. 145,
//     27/07/2022), con su letra h) como la dejó la ECD/866/2024
//     ("situaciones de aprendizaje" en vez de "situaciones didácticas").
//     OJO: en Primaria la programación es DEL CICLO; aquí se hace por curso
//     con los criterios y saberes de su ciclo.
//   - Bachillerato: artículo 54.3 de la ORDEN ECD/1173/2022 (BOA núm. 157,
//     12/08/2022). Ni la ECD/886/2024 ni la ECD/739/2025 lo tocan.
//
// Las letras NO significan lo mismo en cada etapa (la h de ESO es la
// materia pendiente; la de Primaria, la metodología). Por eso cada apartado
// lleva `clave`: qué es, igual en las tres. Las pistas del panel y las guías
// de la IA van por clave; lo que escribe el profesor se guarda por letra.
//
// `de`: de dónde sale el contenido en TutorDigital.
//   curriculo    → se rellena solo con el currículo oficial;
//   unidades     → lo arma el profesor en el paso de unidades didácticas;
//   calificacion → la tabla de pesos del paso de evaluación;
//   texto        → lo escribe el profesor (con una pista de qué poner).
import { etapaDelSlug } from "../curriculo/etapas.js";

const INSTRUMENTOS = "Procedimientos e instrumentos de evaluación, con especial atención al carácter formativo de la evaluación y a su vinculación con los criterios de evaluación.";
const CALIFICACION = "Criterios de calificación.";
const INICIAL = "Características de la evaluación inicial, criterios para su valoración, así como consecuencias de sus resultados en la programación didáctica y, en su caso, el diseño de los instrumentos de evaluación.";
const LECTOR = "Concreción del Plan Lector establecido en el Proyecto Curricular de Etapa.";
const TRANSVERSALES = "Concreción del Plan de implementación de elementos transversales establecido en el Proyecto Curricular de Etapa.";

const ESO = [
  { letra: "a", de: "curriculo", clave: "competencias", titulo: "Competencias específicas y criterios de evaluación asociados a ellas." },
  { letra: "b", de: "unidades", clave: "unidades", titulo: "Concreción, agrupamiento y secuenciación de los saberes básicos y de los criterios de evaluación en unidades didácticas." },
  { letra: "c", de: "texto", clave: "instrumentos", titulo: INSTRUMENTOS },
  { letra: "d", de: "calificacion", clave: "calificacion", titulo: CALIFICACION },
  { letra: "e", de: "texto", clave: "inicial", titulo: INICIAL },
  { letra: "f", de: "texto", clave: "diferencias", titulo: "Actuaciones generales de atención a las diferencias individuales y adaptaciones curriculares para el alumnado que las precise." },
  { letra: "g", de: "texto", clave: "seguimiento", titulo: "Plan de seguimiento personal para el alumnado que no promociona, de acuerdo con lo establecido en al artículo 19.4 de esta Orden." },
  { letra: "h", de: "texto", clave: "pendientes", titulo: "Plan de refuerzo personalizado para materias o ámbitos no superados, de acuerdo con lo establecido en al artículo 20 de esta Orden." },
  { letra: "i", de: "texto", clave: "metodologia", titulo: "Estrategias didácticas y metodológicas: Organización, recursos, agrupamientos, enfoques de enseñanza, criterios para la elaboración de situaciones de aprendizaje y otros elementos que se consideren necesarios." },
  { letra: "j", de: "texto", clave: "lector", titulo: LECTOR },
  { letra: "k", de: "texto", clave: "transversales", titulo: TRANSVERSALES },
  { letra: "l", de: "texto", clave: "digital", titulo: "Concreción del Plan de utilización de las tecnologías digitales establecido en el Proyecto Curricular de Etapa." },
  { letra: "m", de: "texto", clave: "bilingue", titulo: "En su caso, medidas complementarias que se plantean para el tratamiento de las materias o ámbitos dentro de proyectos o itinerarios bilingües o plurilingües, o de proyectos de lenguas y modalidades lingüísticas propias de la Comunidad Autónoma de Aragón." },
  { letra: "n", de: "texto", clave: "revision", titulo: "Mecanismos de revisión, evaluación y modificación de las programaciones didácticas en relación con los resultados académicos y procesos de mejora." },
  { letra: "ñ", de: "texto", clave: "extraescolares", titulo: "Actividades complementarias y extraescolares programadas por cada departamento, equipos didáctico u órgano de coordinación didáctica que corresponda, de acuerdo con el programa anual de actividades complementarias y extraescolares establecidas por el centro, concretando la incidencia de las mismas en la evaluación del alumnado." },
];

const PRIMARIA = [
  { letra: "a", de: "curriculo", clave: "competencias", titulo: "Competencias específicas y criterios de evaluación del ciclo." },
  { letra: "b", de: "unidades", clave: "unidades", titulo: "Concreción, agrupamiento y secuenciación dentro de cada curso de los saberes básicos y de los criterios de evaluación en unidades didácticas." },
  { letra: "c", de: "texto", clave: "instrumentos", titulo: INSTRUMENTOS },
  { letra: "d", de: "calificacion", clave: "calificacion", titulo: CALIFICACION },
  { letra: "e", de: "texto", clave: "inicial", titulo: INICIAL },
  { letra: "f", de: "texto", clave: "diferencias", titulo: "Actuaciones generales de atención a las diferencias individuales para el ciclo y adaptaciones curriculares para el alumnado que las precise." },
  { letra: "g", de: "texto", clave: "seguimiento", titulo: "Plan de seguimiento personalizado." },
  { letra: "h", de: "texto", clave: "metodologia", titulo: "Estrategias didácticas y metodológicas: Organización, recursos, agrupamientos, enfoques de enseñanza, criterios para la elaboración de situaciones de aprendizaje y otros elementos que se consideren necesarios." },
  { letra: "i", de: "texto", clave: "lector", titulo: LECTOR },
  { letra: "j", de: "texto", clave: "transversales", titulo: TRANSVERSALES },
  { letra: "k", de: "texto", clave: "digital", titulo: "Concreción del Plan de utilización de las tecnologías digitales establecido en el Proyecto Curricular de Etapa." },
  { letra: "l", de: "texto", clave: "bilingue", titulo: "En su caso, medidas complementarias que se plantean para el tratamiento del área de conocimiento dentro de proyectos o itinerarios bilingües o plurilingües, o de proyectos de lenguas y modalidades lingüísticas propias de la Comunidad Autónoma de Aragón." },
  { letra: "m", de: "texto", clave: "revision", titulo: "Mecanismos de revisión, evaluación y modificación de las Programaciones Didácticas en relación con los resultados académicos y procesos de mejora." },
  { letra: "n", de: "texto", clave: "extraescolares", titulo: "Actividades complementarias y extraescolares programadas, de acuerdo con el Programa anual de actividades complementarias y extraescolares establecidas por el centro, concretando la incidencia de las mismas en la evaluación del alumnado." },
];

const BACHILLERATO = [
  { letra: "a", de: "curriculo", clave: "competencias", titulo: "Competencias específicas y criterios de evaluación asociados a ellas." },
  { letra: "b", de: "unidades", clave: "unidades", titulo: "Concreción, agrupamiento y secuenciación de los saberes básicos y de los criterios de evaluación en unidades didácticas." },
  { letra: "c", de: "texto", clave: "instrumentos", titulo: INSTRUMENTOS },
  { letra: "d", de: "calificacion", clave: "calificacion", titulo: CALIFICACION },
  { letra: "e", de: "texto", clave: "inicial", titulo: INICIAL },
  { letra: "f", de: "texto", clave: "diferencias", titulo: "Actuaciones generales de atención a las diferencias individuales." },
  { letra: "g", de: "texto", clave: "pendientes", titulo: "Plan de recuperación de materias pendientes." },
  { letra: "h", de: "texto", clave: "metodologia", titulo: "Estrategias didácticas y metodológicas: Organización, recursos, agrupamientos, enfoques de enseñanza, criterios para la elaboración de situaciones de aprendizaje y otros elementos que se consideren necesarios." },
  { letra: "i", de: "texto", clave: "transversales", titulo: TRANSVERSALES },
  { letra: "j", de: "texto", clave: "digital", titulo: "Concreción del Plan de utilización de las Tecnologías digitales establecido en el Proyecto Curricular de Etapa." },
  { letra: "k", de: "texto", clave: "bilingue", titulo: "En su caso, medidas complementarias que se plantean para el tratamiento de las materias dentro de proyectos o itinerarios bilingües o plurilingües o de proyectos de lenguas y modalidades lingüísticas propias de la comunidad autónoma de Aragón." },
  { letra: "l", de: "texto", clave: "revision", titulo: "Mecanismos de revisión, evaluación y modificación de las programaciones Didácticas en relación con los resultados académicos y procesos de mejora." },
  { letra: "m", de: "texto", clave: "extraescolares", titulo: "Actividades complementarias y extraescolares programadas por cada departamento, equipo u órgano de coordinación didáctica que corresponda, de acuerdo con el Programa anual de actividades complementarias y extraescolares establecidas por el centro, concretando la incidencia de las mismas en la evaluación del alumnado." },
];

const POR_ETAPA = { eso: ESO, primaria: PRIMARIA, bachillerato: BACHILLERATO };

const REFERENCIAS = {
  eso: "Artículo 59.3 de la ORDEN ECD/1172/2022, de 2 de agosto (BOA núm. 156, de 11/08/2022)",
  primaria: "Artículo 42.3 de la ORDEN ECD/1112/2022, de 18 de julio (BOA núm. 145, de 27/07/2022), modificado por la ORDEN ECD/866/2024",
  bachillerato: "Artículo 54.3 de la ORDEN ECD/1173/2022, de 3 de agosto (BOA núm. 157, de 12/08/2022)",
};

// Los apartados de la programación de esta materia (el slug dice la etapa).
export function apartadosDe(slug) {
  return POR_ETAPA[etapaDelSlug(slug)];
}

export function referenciaDe(slug) {
  return REFERENCIAS[etapaDelSlug(slug)];
}

// Los que escribe el profesor.
export function apartadosDeTextoDe(slug) {
  return apartadosDe(slug).filter((a) => a.de === "texto");
}

export function apartadoDe(slug, letra) {
  return apartadosDe(slug).find((a) => a.letra === letra) || null;
}
