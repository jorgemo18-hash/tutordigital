import { el } from "../elementos.js";

// EL CURRÍCULO DE UNA MATERIA Y UN CURSO, PINTADO.
//
// Dos columnas en escritorio: competencias específicas con sus criterios de
// evaluación | saberes básicos (bloque → apartado → viñetas). En móvil,
// una debajo de otra (CSS). Todo el texto es el del anexo oficial, tal cual.
function competencias(doc, c) {
  const caja = el(doc, "section", "rc-card rc-cur__col");
  const cab = el(doc, "div", "rc-chd");
  cab.append(el(doc, "h2", "", "Competencias específicas y criterios de evaluación"), el(doc, "span", "rc-sp"),
    el(doc, "span", "rc-k", `${c.competencias.length} competencias`));
  caja.appendChild(cab);
  const lista = el(doc, "div", "rc-cur__lista");
  for (const ce of c.competencias) {
    const item = el(doc, "article", "rc-cur__ce");
    const tit = el(doc, "p", "rc-cur__ce-texto");
    tit.append(el(doc, "b", "rc-cur__codigo", ce.codigo),
      ce.texto ? doc.createTextNode(` ${ce.texto}`) : el(doc, "span", "rc-cur__sin", " (enunciado no extraído del PDF: consúltalo en el anexo)"));
    item.appendChild(tit);
    if (ce.criterios.length) {
      const ul = el(doc, "ul", "rc-cur__criterios");
      // Si hay varias columnas (Matemáticas A y B en 4.º), se dice cuál.
      const varias = new Set(ce.criterios.map((k) => k.columna)).size > 1;
      for (const k of ce.criterios) {
        const li = el(doc, "li");
        li.append(el(doc, "span", "rc-cur__num", k.codigo), doc.createTextNode(` ${k.texto}`));
        if (varias && k.columna) li.appendChild(el(doc, "span", "rc-cur__columna", k.columna));
        ul.appendChild(li);
      }
      item.appendChild(ul);
    }
    lista.appendChild(item);
  }
  if (c.criteriosSueltos?.length) {
    const item = el(doc, "article", "rc-cur__ce");
    item.appendChild(el(doc, "p", "rc-cur__ce-texto", "Criterios cuya competencia no se pudo leer del PDF"));
    const ul = el(doc, "ul", "rc-cur__criterios");
    for (const k of c.criteriosSueltos) {
      const li = el(doc, "li");
      li.append(el(doc, "span", "rc-cur__num", k.codigo), doc.createTextNode(` ${k.texto}`));
      ul.appendChild(li);
    }
    item.appendChild(ul);
    lista.appendChild(item);
  }
  if (!lista.children.length) lista.appendChild(el(doc, "p", "rc-cur__vacio", "Nada coincide con la búsqueda."));
  caja.appendChild(lista);
  return caja;
}

function saberes(doc, c) {
  const caja = el(doc, "section", "rc-card rc-cur__col");
  const cab = el(doc, "div", "rc-chd");
  cab.append(el(doc, "h2", "", "Saberes básicos"));
  caja.appendChild(cab);
  const cuerpo = el(doc, "div", "rc-cur__lista");
  for (const s of c.saberes) {
    // Varias secciones en un curso (Matemáticas A y B): se titula cada una.
    if (c.saberes.length > 1) cuerpo.appendChild(el(doc, "div", "rc-crumb rc-cur__seccion", s.etiqueta));
    for (const b of s.bloques) {
      const bloque = el(doc, "div", "rc-cur__bloque");
      if (b.bloque) bloque.appendChild(el(doc, "h3", "rc-cur__bloque-titulo", b.bloque));
      for (const a of b.apartados) {
        const ap = el(doc, "div", "rc-cur__apartado");
        if (a.codigo || a.nombre) {
          const t = el(doc, "p", "rc-cur__apartado-titulo");
          if (a.codigo) t.appendChild(el(doc, "b", "rc-cur__codigo", a.codigo));
          if (a.nombre) t.appendChild(doc.createTextNode(` ${a.nombre}`));
          ap.appendChild(t);
        }
        const ul = el(doc, "ul", "rc-cur__saberes");
        for (const v of a.saberes) ul.appendChild(el(doc, "li", "", v));
        ap.appendChild(ul);
        bloque.appendChild(ap);
      }
      cuerpo.appendChild(bloque);
    }
  }
  if (!cuerpo.children.length) cuerpo.appendChild(el(doc, "p", "rc-cur__vacio", "Nada coincide con la búsqueda."));
  caja.appendChild(cuerpo);
  return caja;
}

export function pintaCurriculo({ contenedor, curriculo, doc = document }) {
  const rejilla = el(doc, "div", "rc-cur");
  rejilla.append(competencias(doc, curriculo), saberes(doc, curriculo));
  const pie = el(doc, "p", "rc-foot rc-cur__fuente",
    `${curriculo.fuente}. Extraído automáticamente del PDF oficial`
    + (curriculo.literal != null ? `: el ${String(curriculo.literal).replace(".", ",")} % comprobado literal.` : "."));
  contenedor.replaceChildren(rejilla, pie);
}
