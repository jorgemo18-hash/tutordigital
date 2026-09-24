// LO QUE TIENE QUE LLEVAR UNA PROGRAMACIÓN DIDÁCTICA EN ARAGÓN.
//
// Artículo 59.3 de la ORDEN ECD/1172/2022 (currículo y evaluación de la
// ESO): "Las programaciones didácticas de cada curso incluirán, al menos,
// los siguientes aspectos en cada materia o ámbito". Texto literal del BOA
// (núm. 156, 11/08/2022), en su orden y con su letra. El generador de
// programaciones sigue exactamente este índice: es lo que Inspección va a
// buscar.
//
// `de`: de dónde sale el contenido en TutorDigital.
//   curriculo  → se rellena solo con el currículo oficial (competencias y
//                criterios de la materia y curso);
//   unidades   → lo arma el profesor en el paso de unidades didácticas;
//   calificacion → la tabla de pesos del paso de evaluación;
//   texto      → lo escribe el profesor (con una pista de qué poner).
export const APARTADOS = [
  { letra: "a", de: "curriculo", titulo: "Competencias específicas y criterios de evaluación asociados a ellas." },
  { letra: "b", de: "unidades", titulo: "Concreción, agrupamiento y secuenciación de los saberes básicos y de los criterios de evaluación en unidades didácticas." },
  { letra: "c", de: "texto", titulo: "Procedimientos e instrumentos de evaluación, con especial atención al carácter formativo de la evaluación y a su vinculación con los criterios de evaluación." },
  { letra: "d", de: "calificacion", titulo: "Criterios de calificación." },
  { letra: "e", de: "texto", titulo: "Características de la evaluación inicial, criterios para su valoración, así como consecuencias de sus resultados en la programación didáctica y, en su caso, el diseño de los instrumentos de evaluación." },
  { letra: "f", de: "texto", titulo: "Actuaciones generales de atención a las diferencias individuales y adaptaciones curriculares para el alumnado que las precise." },
  { letra: "g", de: "texto", titulo: "Plan de seguimiento personal para el alumnado que no promociona, de acuerdo con lo establecido en al artículo 19.4 de esta Orden." },
  { letra: "h", de: "texto", titulo: "Plan de refuerzo personalizado para materias o ámbitos no superados, de acuerdo con lo establecido en al artículo 20 de esta Orden." },
  { letra: "i", de: "texto", titulo: "Estrategias didácticas y metodológicas: Organización, recursos, agrupamientos, enfoques de enseñanza, criterios para la elaboración de situaciones de aprendizaje y otros elementos que se consideren necesarios." },
  { letra: "j", de: "texto", titulo: "Concreción del Plan Lector establecido en el Proyecto Curricular de Etapa." },
  { letra: "k", de: "texto", titulo: "Concreción del Plan de implementación de elementos transversales establecido en el Proyecto Curricular de Etapa." },
  { letra: "l", de: "texto", titulo: "Concreción del Plan de utilización de las tecnologías digitales establecido en el Proyecto Curricular de Etapa." },
  { letra: "m", de: "texto", titulo: "En su caso, medidas complementarias que se plantean para el tratamiento de las materias o ámbitos dentro de proyectos o itinerarios bilingües o plurilingües, o de proyectos de lenguas y modalidades lingüísticas propias de la Comunidad Autónoma de Aragón." },
  { letra: "n", de: "texto", titulo: "Mecanismos de revisión, evaluación y modificación de las programaciones didácticas en relación con los resultados académicos y procesos de mejora." },
  { letra: "ñ", de: "texto", titulo: "Actividades complementarias y extraescolares programadas por cada departamento, equipos didáctico u órgano de coordinación didáctica que corresponda, de acuerdo con el programa anual de actividades complementarias y extraescolares establecidas por el centro, concretando la incidencia de las mismas en la evaluación del alumnado." },
];

export const REFERENCIA = "Artículo 59.3 de la ORDEN ECD/1172/2022, de 2 de agosto (BOA núm. 156, de 11/08/2022)";

// Las que escribe el profesor.
export const APARTADOS_DE_TEXTO = APARTADOS.filter((a) => a.de === "texto");
