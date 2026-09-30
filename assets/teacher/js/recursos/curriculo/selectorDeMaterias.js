import { el } from "../elementos.js";
import { nombreDelCurso } from "../../../../shared/curriculo/etapas.js";

// EL DESPLEGABLE DE MATERIAS DEL CURRÍCULO, agrupado por etapa, y el de
// cursos de la materia elegida. Lo usan Recursos → Currículo y Recursos →
// Programación: los dos tienen que ofrecer las mismas materias.
export const ETAPAS_EN_PANTALLA = ["Primaria", "ESO", "FP Básica", "Bachillerato"];

export function selectorDeMaterias(doc, materias, etapas = ETAPAS_EN_PANTALLA) {
  const sel = el(doc, "select", "rc-sel");
  for (const etapa of etapas) {
    const grupo = el(doc, "optgroup");
    grupo.label = etapa;
    const deLaEtapa = materias.filter((x) => x.etapa === etapa).sort((a, b) => a.materia.localeCompare(b.materia, "es"));
    for (const m of deLaEtapa) {
      const o = el(doc, "option", "", m.materia);
      o.value = m.slug;
      grupo.appendChild(o);
    }
    if (grupo.children.length) sel.appendChild(grupo);
  }
  return sel;
}

// Los cursos de la materia ("3.º de Primaria"…); `cursoUnico` es el texto
// de la opción cuando el anexo no dice el curso (null: no se ofrece).
export function opcionesDeCurso(doc, sel, materia, { curso = null, cursoUnico = "Curso único", siNoDice = [] } = {}) {
  const cursos = materia?.cursos?.length ? materia.cursos : siNoDice;
  const ops = cursos.length ? cursos.map((n) => [n, nombreDelCurso(materia?.slug, n)]) : [["", cursoUnico]];
  sel.replaceChildren(...ops.map(([v, t]) => { const o = el(doc, "option", "", t); o.value = String(v); return o; }));
  sel.value = cursos.includes(curso) ? String(curso) : String(ops[0][0]);
}
