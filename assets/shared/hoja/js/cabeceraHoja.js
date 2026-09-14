// LA CABECERA DE LA HOJA: de qué es, y los huecos de nombre / curso / fecha.
//
// El título grande es EL OBJETIVO, no el tema. "Números enteros" es un tema y
// da para cinco hojas; "Sumar y restar números enteros" es una hoja. Es lo que
// hacen las fichas de refuerzo de Santillana ("OBJETIVO 1 · Calcular términos
// en una sucesión") y es lo que evita que la hoja se llene de todo lo del tema.
//
// Los huecos de nombre y fecha los rellena el alumno a mano. Parecen un detalle
// de imprenta y no lo son: una hoja corregida sin nombre no se puede registrar,
// y sin registro no hay nada que medir después.

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function textoFecha(fecha = new Date()) {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

function buildDato(label, { ancho = false, texto = "" } = {}, doc) {
  const wrap = doc.createElement("div");
  wrap.className = ancho ? "hj-dato hj-dato--ancho" : "hj-dato";

  const lab = doc.createElement("span");
  lab.className = "hj-dato-label";
  lab.textContent = label;

  const linea = doc.createElement("span");
  linea.className = "hj-dato-linea";
  // Si el dato ya se conoce (el curso, por ejemplo) se imprime en vez de
  // dejarlo en blanco: menos cosas que escribir a mano, menos hojas sin
  // identificar.
  if (texto) linea.textContent = texto;

  wrap.append(lab, linea);
  return wrap;
}

export function buildCabecera({
  materia = "",
  curso = "",
  tema = "",
  objetivo = "",
  codigo = "",
  doc = globalThis.document,
} = {}) {
  const head = doc.createElement("header");
  head.className = "hj-head";

  const linea = doc.createElement("div");
  linea.className = "hj-head-linea";

  const izq = doc.createElement("span");
  izq.className = "hj-head-materia";
  // Materia, curso y tema en la misma línea pequeña: el título grande es solo
  // el objetivo. Puestos en dos líneas distintas se comían un centímetro de
  // folio para decir lo mismo.
  izq.textContent = [materia, curso, tema].filter(Boolean).join(" · ");

  const spacer = doc.createElement("span");
  spacer.className = "hj-head-spacer";

  const der = doc.createElement("span");
  der.textContent = codigo;

  linea.append(izq, spacer, der);

  const h1 = doc.createElement("h1");
  h1.className = "hj-title";
  h1.textContent = objetivo;

  head.append(linea, h1);

  const datos = doc.createElement("div");
  datos.className = "hj-datos";
  datos.append(
    buildDato("Nombre", { ancho: true }, doc),
    buildDato("Curso", { texto: curso }, doc),
    buildDato("Fecha", {}, doc),
  );
  head.appendChild(datos);

  return head;
}
