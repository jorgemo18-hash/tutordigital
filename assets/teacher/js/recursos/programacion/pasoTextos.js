import { el } from "../elementos.js";
import { APARTADOS } from "../../../../shared/programacion/apartadosLegales.js";

// LOS APARTADOS QUE ESCRIBE EL PROFESOR (art. 59.3): un cuadro de texto por
// letra, con el título LITERAL de la Orden encima (es lo que Inspección
// busca) y una pista corta dentro. Las pistas son nuestras, no de la ley.
export const PISTAS = {
  c: "Qué instrumentos usarás (observación, cuaderno, pruebas, rúbricas…), cuándo, y qué criterios evalúa cada uno.",
  e: "Cómo será la evaluación inicial (prueba, observación, informe del curso anterior), cómo se valora y qué cambia en la programación según el resultado.",
  f: "Medidas generales para el grupo (refuerzo, ampliación, agrupamientos flexibles) y cómo se harán las adaptaciones de quien las necesite.",
  g: "Qué seguimiento se hace al alumnado que repite: revisión de dificultades del curso anterior, seguimiento trimestral, coordinación con tutoría.",
  h: "Cómo se recupera la materia pendiente del curso anterior: actividades, calendario, quién lo evalúa y con qué criterios.",
  i: "Cómo se organiza el aula, recursos, agrupamientos y enfoque de enseñanza; criterios para diseñar situaciones de aprendizaje.",
  j: "Qué se hace en esta materia dentro del Plan Lector del centro (lecturas, tiempos, tipos de texto).",
  k: "Cómo se trabajan los elementos transversales (igualdad, educación para la salud, sostenibilidad…) en esta materia.",
  l: "Qué herramientas y tecnologías digitales se usan y para qué, según el plan del centro.",
  m: "Solo si hay programa bilingüe o de lenguas propias de Aragón. Si no, puede quedar: «No procede».",
  n: "Cuándo y cómo se revisa la programación: a partir de qué resultados, quién lo decide y cómo se registra.",
  ñ: "Actividades complementarias y extraescolares previstas y cómo cuentan (o no) en la evaluación.",
};

export function cuadroDeTexto({ letra, datos, onCambio, doc = document }) {
  const a = APARTADOS.find((x) => x.letra === letra);
  datos.textos = datos.textos || {};
  const caja = el(doc, "label", "rc-pg__texto");
  caja.append(el(doc, "span", "rc-pg__letra", `${letra})`), el(doc, "span", "rc-pg__titulo", a?.titulo || ""));
  const t = el(doc, "textarea", "rc-ta rc-pg__area");
  t.rows = 5;
  t.value = datos.textos[letra] || "";
  t.placeholder = PISTAS[letra] || "";
  t.dataset.letra = letra;
  t.addEventListener("input", () => { datos.textos[letra] = t.value; onCambio(); });
  caja.appendChild(t);
  return caja;
}

export function pintarPasoTextos({ contenedor, letras, datos, onCambio, doc = document }) {
  const lista = el(doc, "div", "rc-pg__textos");
  for (const letra of letras) lista.appendChild(cuadroDeTexto({ letra, datos, onCambio, doc }));
  contenedor.replaceChildren(lista);
}
