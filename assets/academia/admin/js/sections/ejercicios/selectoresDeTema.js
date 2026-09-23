// CURSO → MATERIA → TEMA, en cascada. Jorge, el 23/9: *"tendría que poderse
// elegir curso, materia y tema"*, y en la academia todos, porque el panel es
// del centro y no de un profesor.
//
// Las opciones salen de los temas del catálogo (`catalogo.temas`), y cada
// selector solo ofrece lo que existe con lo elegido en el anterior: no se
// puede llegar a una combinación sin tema. Hoy hay un tema, así que cada
// selector tiene una opción; crecerán solos cuando entren más.
function unicos(lista) {
  return [...new Set(lista)];
}

function llenar(select, valores, textoDe, doc) {
  select.replaceChildren();
  for (const v of valores) {
    const op = doc.createElement("option");
    op.value = v;
    op.textContent = textoDe(v);
    select.appendChild(op);
  }
}

export function buildSelectoresDeTema({ temas, temaId, onCambio, doc = document }) {
  const curso = doc.createElement("select");
  const materia = doc.createElement("select");
  const tema = doc.createElement("select");
  for (const s of [curso, materia, tema]) s.className = "ac-select ej-select-corto";

  let actual = temas.find((t) => t.id === temaId) || temas[0];

  function pintar() {
    llenar(curso, unicos(temas.map((t) => t.curso)), (v) => v, doc);
    curso.value = actual.curso;
    llenar(materia, unicos(temas.filter((t) => t.curso === actual.curso).map((t) => t.materia)), (v) => v, doc);
    materia.value = actual.materia;
    const deAqui = temas.filter((t) => t.curso === actual.curso && t.materia === actual.materia);
    llenar(tema, deAqui.map((t) => t.id), (id) => temas.find((t) => t.id === id).nombre, doc);
    tema.value = actual.id;
  }

  // Al cambiar uno de arriba, el de abajo pasa al primero que exista.
  function elige(predicado) {
    const nuevo = temas.find(predicado);
    if (!nuevo || nuevo.id === actual.id) { pintar(); return; }
    actual = nuevo;
    pintar();
    onCambio(actual);
  }
  curso.addEventListener("change", () => elige((t) => t.curso === curso.value));
  materia.addEventListener("change", () => elige((t) => t.curso === actual.curso && t.materia === materia.value));
  tema.addEventListener("change", () => elige((t) => t.id === tema.value));

  pintar();
  return { curso, materia, tema, controles: [curso, materia, tema] };
}
