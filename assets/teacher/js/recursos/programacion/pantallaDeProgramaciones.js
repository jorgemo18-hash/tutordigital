import { el, boton, campo } from "../elementos.js";
import { materiaDeLaAsignatura } from "../curriculo/filtroDelCurriculo.js";
import { selectorDeMaterias, opcionesDeCurso } from "../curriculo/selectorDeMaterias.js";
import { ETAPAS, etapaDelSlug, nombreDelCurso } from "../../../../shared/curriculo/etapas.js";
import { abrirEditorDeProgramacion } from "./editorDeProgramacion.js";

// RECURSOS → PROGRAMACIÓN: las programaciones didácticas del profesor, con
// la estructura que pide la orden de cada etapa (ver shared/programacion/
// apartadosLegales.js) y el currículo oficial ya dentro. Lista de las suyas
// + "Nueva"; al abrir una, el editor. Primaria, ESO y Bachillerato; los
// ámbitos de FP Básica no (su programación la rige otra norma).
function fecha(iso) {
  try { return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; }
}

export function createPantallaDeProgramaciones({ api, centro = "", getAsignatura = () => "", doc = document, reloj = globalThis }) {
  let raiz = null;
  let materias = [];
  let editor = null;

  const nombreDe = (slug) => materias.find((m) => m.slug === slug)?.materia || slug;

  function formularioNueva(onCrear) {
    const f = el(doc, "div", "rc-card rc-ctx rc-pg__nueva");
    const materia = selectorDeMaterias(doc, materias, ["Primaria", "ESO", "Bachillerato"]);
    materia.value = materiaDeLaAsignatura(materias.filter((m) => m.etapa !== "FP Básica"), getAsignatura()) || "matematicas";
    const curso = el(doc, "select", "rc-sel");
    // Una materia sin curso en el anexo: se ofrecen los de su etapa.
    const cursos = () => opcionesDeCurso(doc, curso, materias.find((x) => x.slug === materia.value), {
      siNoDice: ETAPAS[etapaDelSlug(materia.value)].cursos,
    });
    materia.addEventListener("change", cursos);
    cursos();
    const crear = boton(doc, "Crear programación", { clase: "rc-btn--pri", onClick: () => onCrear(materia.value, Number(curso.value), crear) });
    f.append(campo(doc, "Materia", materia, "rc-fld--materia-cur"), campo(doc, "Curso", curso, "rc-fld--curso"), crear);
    return f;
  }

  async function crear(slug, curso, btn, msg) {
    btn.disabled = true;
    msg.textContent = "Creando…";
    try {
      const nueva = await api.creaProgramacion({ materia_slug: slug, curso, titulo: `${nombreDe(slug)} ${nombreDelCurso(slug, curso)}` });
      await abrir(nueva.id);
    } catch (err) {
      msg.textContent = err?.message || "No se pudo crear la programación.";
      btn.disabled = false;
    }
  }

  async function abrir(id) {
    editor = await abrirEditorDeProgramacion({ raiz, api, id, centro, doc, reloj, onVolver: () => { editor = null; lista(); } });
  }

  async function borrar(p, msg) {
    if (!doc.defaultView?.confirm?.(`¿Borrar «${p.titulo || "sin título"}»? No se puede deshacer.`)) return;
    try {
      await api.borraProgramacion(p.id);
      await lista();
    } catch (err) {
      msg.textContent = err?.message || "No se pudo borrar.";
    }
  }

  async function lista() {
    raiz.replaceChildren(el(doc, "p", "rc-msg", "Cargando tus programaciones…"));
    let mias = [];
    try {
      if (!materias.length) materias = (await api.materiasDelCurriculo()).materias || [];
      mias = (await api.programaciones()).programaciones || [];
    } catch (err) {
      raiz.replaceChildren(el(doc, "p", "rc-msg rc-msg--error", err?.message || "No se pudieron cargar las programaciones."));
      return;
    }
    const cab = el(doc, "div", "rc-head");
    const tit = el(doc, "div");
    tit.append(el(doc, "div", "rc-crumb", "Recursos · Programación"), el(doc, "h1", "rc-h1", "Programaciones didácticas"));
    cab.appendChild(tit);
    const intro = el(doc, "p", "rc-sub", "Con la estructura que pide la orden de cada etapa (Primaria, ESO y Bachillerato de Aragón) y el currículo oficial dentro: eliges materia y curso, repartes saberes y criterios en unidades, y sale el documento con todos sus apartados.");
    const msg = el(doc, "p", "rc-msg");
    msg.setAttribute("role", "status");
    const nueva = formularioNueva((slug, curso, btn) => crear(slug, curso, btn, msg));

    const caja = el(doc, "div", "rc-card rc-pg__lista");
    caja.appendChild(el(doc, "div", "rc-crumb", "Mis programaciones"));
    if (!mias.length) caja.appendChild(el(doc, "p", "rc-sub", "Todavía no tienes ninguna. Elige materia y curso arriba y pulsa «Crear programación»."));
    for (const p of mias) {
      const fila = el(doc, "div", "rc-pg__fila");
      const abrirBtn = el(doc, "button", "rc-pg__abrir");
      abrirBtn.type = "button";
      abrirBtn.append(el(doc, "b", "", p.titulo || "Sin título"), el(doc, "span", "rc-sub", `${nombreDe(p.materia_slug)}${p.curso ? ` · ${nombreDelCurso(p.materia_slug, p.curso)}` : ""} · ${fecha(p.updated_at)}`));
      abrirBtn.addEventListener("click", () => abrir(p.id));
      fila.append(abrirBtn, boton(doc, "Borrar", { clase: "rc-btn--sm rc-btn--gh", onClick: () => borrar(p, msg) }));
      caja.appendChild(fila);
    }
    raiz.replaceChildren(cab, intro, nueva, msg, caja);
  }

  return {
    render(r) { raiz = r; return lista(); },
    get editor() { return editor; },
  };
}
