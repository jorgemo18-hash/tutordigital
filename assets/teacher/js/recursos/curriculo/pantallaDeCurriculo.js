import { el, campo, selector } from "../elementos.js";
import { filtraCurriculo, materiaDeLaAsignatura } from "./filtroDelCurriculo.js";
import { pintaCurriculo } from "./pintaCurriculo.js";
import { selectorDeMaterias, opcionesDeCurso } from "./selectorDeMaterias.js";

// RECURSOS → CURRÍCULO: el currículo oficial de Aragón para consultar
// (Jorge, 24/9: "poner ya todas las asignaturas, temas, apartados,
// saberes"; 30/9: también Primaria y Bachillerato). Materia, curso y una
// búsqueda; se abre en la asignatura que el profesor tiene elegida arriba
// si está en el currículo.
//
// Es también el primer paso del generador de programaciones: lo que se
// programa son estos criterios y estos saberes.
export function createPantallaDeCurriculo({ api, getAsignatura = () => "", doc = document }) {
  let materias = [];
  let actual = null; // el currículo de la materia y curso elegidos
  const p = {};

  function pintar() {
    if (!actual) return;
    pintaCurriculo({ contenedor: p.cuerpo, curriculo: filtraCurriculo(actual, p.buscar.value), doc });
  }

  const materiaDe = (slug) => materias.find((x) => x.slug === slug);

  async function cargar() {
    const slug = p.materia.value;
    const curso = p.curso.value ? Number(p.curso.value) : null;
    p.msg.textContent = "Cargando…";
    try {
      actual = await api.curriculo(slug, curso);
      p.msg.textContent = "";
      pintar();
    } catch (err) {
      p.msg.textContent = err?.message || "No se pudo cargar el currículo.";
    }
  }

  async function render(raiz) {
    raiz.replaceChildren(el(doc, "p", "rc-msg", "Cargando el currículo…"));
    try {
      materias = (await api.materiasDelCurriculo()).materias || [];
    } catch (err) {
      raiz.replaceChildren(el(doc, "p", "rc-msg rc-msg--error", err?.message || "No se pudo cargar el currículo."));
      return;
    }
    const cab = el(doc, "div", "rc-head");
    const tit = el(doc, "div");
    tit.append(el(doc, "div", "rc-crumb", "Recursos · Currículo"), el(doc, "h1", "rc-h1", "Currículo oficial de Aragón"));
    cab.appendChild(tit);

    // Materias agrupadas por etapa (los ámbitos de FP Básica, aparte).
    p.materia = selectorDeMaterias(doc, materias);
    p.materia.value = materiaDeLaAsignatura(materias, getAsignatura()) || "matematicas";
    p.curso = selector(doc, [], null);
    opcionesDeCurso(doc, p.curso, materiaDe(p.materia.value), { curso: 1 });
    p.buscar = el(doc, "input", "rc-sel rc-cur__buscar");
    p.buscar.type = "search";
    p.buscar.placeholder = "Buscar: recta numérica, probabilidad, CE.M.4…";

    p.materia.addEventListener("change", () => {
      opcionesDeCurso(doc, p.curso, materiaDe(p.materia.value), { curso: Number(p.curso.value) });
      cargar();
    });
    p.curso.addEventListener("change", () => cargar());
    p.buscar.addEventListener("input", () => pintar());

    const barra = el(doc, "div", "rc-card rc-ctx rc-cur__ctx");
    barra.append(
      campo(doc, "Materia", p.materia, "rc-fld--materia-cur"),
      campo(doc, "Curso", p.curso, "rc-fld--curso"),
      campo(doc, "Buscar", p.buscar, "rc-fld--buscar"),
    );
    p.msg = el(doc, "p", "rc-msg");
    p.msg.setAttribute("role", "status");
    p.cuerpo = el(doc, "div");
    raiz.replaceChildren(cab, barra, p.msg, p.cuerpo);
    await cargar();
  }

  return { render, get estado() { return { actual, materia: p.materia?.value, curso: p.curso?.value }; } };
}
