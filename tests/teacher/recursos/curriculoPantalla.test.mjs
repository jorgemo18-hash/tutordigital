import { Window } from "happy-dom";

const window = new Window();
const document = window.document;

// RECURSOS → CURRÍCULO (js/recursos/curriculo/).
export async function run({ test, assert }) {
  const { filtraCurriculo, materiaDeLaAsignatura } = await import("../../../assets/teacher/js/recursos/curriculo/filtroDelCurriculo.js");
  const { createPantallaDeCurriculo } = await import("../../../assets/teacher/js/recursos/curriculo/pantallaDeCurriculo.js");

  const MATERIAS = [
    { slug: "matematicas", materia: "Matemáticas", cursos: [1, 2, 3, 4], etapa: "ESO" },
    { slug: "matematicas-para-la-toma-de-decisiones", materia: "Matemáticas para la toma de decisiones", cursos: [], etapa: "ESO" },
    { slug: "lengua-extranjera-ingles", materia: "Lengua Extranjera Inglés", cursos: [1, 2, 3, 4], etapa: "ESO" },
    { slug: "ambito-de-ciencias-aplicadas", materia: "Ámbito de Ciencias Aplicadas", cursos: [1, 2], etapa: "FP Básica" },
  ];
  const CUR = {
    materia: "Matemáticas", curso: 1, fuente: "ORDEN ECD/1172/2022, anexo II (Aragón)", literal: 99.7,
    competencias: [
      { codigo: "CE.M.1", texto: "Interpretar, modelizar y resolver problemas", criterios: [{ codigo: "1.1", texto: "Interpretar problemas matemáticos", columna: "x" }] },
      { codigo: "CE.M.2", texto: "Analizar las soluciones", criterios: [{ codigo: "2.1", texto: "Comprobar la corrección matemática", columna: "x" }] },
    ],
    criteriosSueltos: [],
    saberes: [{ etiqueta: "Matemáticas 1º de ESO", cursos: [1], bloques: [
      { bloque: "A. Sentido numérico", apartados: [
        { codigo: "A.2", nombre: "Cantidad", saberes: ["Diferentes formas de representación de números enteros, incluida la recta numérica."] },
        { codigo: "A.3", nombre: "Sentido de las operaciones", saberes: ["Efecto de las operaciones aritméticas"] },
      ] },
      { bloque: "E. Sentido estocástico", apartados: [{ codigo: "E.2", nombre: "Incertidumbre", saberes: ["Probabilidad: regla de Laplace"] }] },
    ] }],
  };

  test("BUSCAR sin tildes: 'recta numerica' deja solo el apartado que la tiene", () => {
    const f = filtraCurriculo(CUR, "recta numerica");
    assert.equal(f.saberes[0].bloques.length, 1);
    assert.equal(f.saberes[0].bloques[0].apartados[0].codigo, "A.2");
    assert.equal(f.competencias.length, 0);
  });

  test("buscar un criterio deja su competencia solo con ese criterio; el código también se busca", () => {
    const f = filtraCurriculo(CUR, "corrección");
    assert.deepEqual(f.competencias.map((c) => c.codigo), ["CE.M.2"]);
    assert.equal(filtraCurriculo(CUR, "ce.m.1").competencias[0].criterios.length, 1, "coincide la competencia: con todos sus criterios");
    assert.equal(filtraCurriculo(CUR, ""), CUR);
  });

  test("la asignatura del profesor elige la materia: la más parecida y la más corta", () => {
    assert.equal(materiaDeLaAsignatura(MATERIAS, "Matemáticas"), "matematicas");
    assert.equal(materiaDeLaAsignatura(MATERIAS, "matematicas"), "matematicas");
    assert.equal(materiaDeLaAsignatura(MATERIAS, "Inglés"), "lengua-extranjera-ingles");
    assert.equal(materiaDeLaAsignatura(MATERIAS, "Música"), null);
    assert.equal(materiaDeLaAsignatura(MATERIAS, ""), null);
  });

  function montar(asignatura = "Matemáticas") {
    const pedidas = [];
    const api = {
      materiasDelCurriculo: async () => ({ materias: MATERIAS }),
      curriculo: async (slug, curso) => { pedidas.push([slug, curso]); return CUR; },
    };
    const pantalla = createPantallaDeCurriculo({ api, doc: document, getAsignatura: () => asignatura });
    const raiz = document.createElement("div");
    return { pantalla, raiz, pedidas };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  test("PANTALLA: abre en la materia del profesor y 1.º; pinta competencias con criterios y saberes por bloque", async () => {
    const m = montar("Inglés");
    await m.pantalla.render(m.raiz);
    assert.deepEqual(m.pedidas[0], ["lengua-extranjera-ingles", 1]);
    assert.equal(m.raiz.querySelectorAll(".rc-cur__ce").length, 2);
    assert.equal(m.raiz.querySelectorAll(".rc-cur__bloque").length, 2);
    assert.ok(m.raiz.querySelector(".rc-cur__fuente").textContent.includes("99,7 %"));
    // Los ámbitos de FP Básica, aparte.
    assert.deepEqual([...m.raiz.querySelectorAll("optgroup")].map((g) => g.label), ["ESO", "FP Básica"]);
  });

  test("cambiar de curso o de materia pide ese currículo; una materia sin cursos pide 'curso único'", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    const [materia, curso] = m.raiz.querySelectorAll(".rc-ctx select");
    curso.value = "3";
    curso.dispatchEvent(new window.Event("change"));
    await tick();
    assert.deepEqual(m.pedidas.at(-1), ["matematicas", 3]);
    materia.value = "matematicas-para-la-toma-de-decisiones";
    materia.dispatchEvent(new window.Event("change"));
    await tick();
    assert.deepEqual(m.pedidas.at(-1), ["matematicas-para-la-toma-de-decisiones", null]);
    assert.equal(curso.options[0].textContent, "Curso único");
  });

  test("buscar en la pantalla filtra lo pintado sin volver a pedir nada", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    const antes = m.pedidas.length;
    const buscar = m.raiz.querySelector(".rc-cur__buscar");
    buscar.value = "laplace";
    buscar.dispatchEvent(new window.Event("input"));
    assert.equal(m.raiz.querySelectorAll(".rc-cur__apartado").length, 1);
    assert.ok(m.raiz.querySelector(".rc-cur__vacio"), "sin competencias que coincidan, se dice");
    assert.equal(m.pedidas.length, antes);
  });
}
