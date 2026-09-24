import { el, boton } from "../elementos.js";
import { APARTADOS, REFERENCIA } from "../../../../shared/programacion/apartadosLegales.js";
import { saberesConId, criteriosDe, sumaDePesos, pesoPorCompetencia, modoDeCalificacion } from "../../../../shared/programacion/estructuraDeLaProgramacion.js";

// EL DOCUMENTO: la programación entera, en el orden y con las letras del
// artículo 59.3 (a–ñ), lista para imprimir o guardar como PDF desde el
// navegador. a) sale del currículo oficial; b) de las unidades; d) de los
// pesos; el resto, de lo que ha escrito el profesor. Lo que falta se marca
// en el papel ("Sin redactar") en vez de esconderlo: mejor verlo aquí que
// que lo vea Inspección.
function seccion(doc, a) {
  const s = el(doc, "section", "rc-doc__sec");
  s.appendChild(el(doc, "h2", "rc-doc__h2", `${a.letra}) ${a.titulo}`));
  return s;
}

function apartadoA(doc, s, curriculo) {
  for (const ce of curriculo.competencias || []) {
    const p = el(doc, "p", "rc-doc__ce");
    p.append(el(doc, "b", "", ce.codigo), doc.createTextNode(` ${ce.texto || "(enunciado: ver anexo II de la Orden)"}`));
    s.appendChild(p);
    if (ce.criterios.length) {
      const ul = el(doc, "ul", "rc-doc__lista");
      for (const k of ce.criterios) ul.appendChild(el(doc, "li", "", `${k.codigo}. ${k.texto}`));
      s.appendChild(ul);
    }
  }
}

function apartadoB(doc, s, curriculo, datos) {
  const porId = new Map(saberesConId(curriculo).map((x) => [x.id, x]));
  const unidades = datos.unidades || [];
  if (!unidades.length) { s.appendChild(el(doc, "p", "rc-doc__falta", "Sin unidades didácticas.")); return; }
  const tabla = el(doc, "table", "rc-doc__tabla");
  const cab = el(doc, "tr");
  ["UD", "Título", "Trimestre", "Sesiones", "Criterios"].forEach((t) => cab.appendChild(el(doc, "th", "", t)));
  tabla.appendChild(cab);
  unidades.forEach((u, i) => {
    const tr = el(doc, "tr");
    [String(i + 1), u.titulo || "Sin título", `${u.trimestre}.º`, String(u.sesiones || 0), u.criterios.join(", ")]
      .forEach((t) => tr.appendChild(el(doc, "td", "", t)));
    tabla.appendChild(tr);
  });
  s.appendChild(tabla);
  // Lo que está en TODAS las unidades (el sentido socioafectivo, por
  // ejemplo) se escribe una vez, no once: repetido en cada unidad, tapaba lo
  // propio de cada una.
  const enTodas = unidades.length > 1
    ? unidades[0].saberes.filter((id) => unidades.every((u) => u.saberes.includes(id)))
    : [];
  const lista = (ids) => {
    const ul = el(doc, "ul", "rc-doc__lista");
    ids.map((id) => porId.get(id)).filter(Boolean)
      .forEach((x) => ul.appendChild(el(doc, "li", "", `${x.apartado ? `${x.apartado} ` : ""}${x.texto}`)));
    return ul;
  };
  if (enTodas.length) {
    s.appendChild(el(doc, "h3", "rc-doc__h3", "En todas las unidades"));
    s.appendChild(lista(enTodas));
  }
  unidades.forEach((u, i) => {
    s.appendChild(el(doc, "h3", "rc-doc__h3", `UD ${i + 1}. ${u.titulo || "Sin título"}`));
    const ul = lista(u.saberes.filter((id) => !enTodas.includes(id)));
    if (!ul.children.length) ul.appendChild(el(doc, "li", "rc-doc__falta", enTodas.length ? "Solo los saberes comunes a todas las unidades." : "Sin saberes asignados."));
    s.appendChild(ul);
  });
}

function tablaDePesos(doc, cabeceras, filas) {
  const tabla = el(doc, "table", "rc-doc__tabla");
  const cab = el(doc, "tr");
  cabeceras.forEach((t) => cab.appendChild(el(doc, "th", "", t)));
  tabla.appendChild(cab);
  for (const fila of filas) {
    const tr = el(doc, "tr");
    fila.forEach((t) => tr.appendChild(el(doc, "td", "", t)));
    tabla.appendChild(tr);
  }
  return tabla;
}

const porciento = (v) => `${Math.round((Number(v) || 0) * 10) / 10} %`;

function apartadoD(doc, s, curriculo, datos) {
  const pesos = datos.pesos || {};
  if (modoDeCalificacion(datos) === "criterio") {
    const porCe = pesoPorCompetencia(curriculo, pesos);
    const filas = [];
    for (const ce of (curriculo.competencias || []).filter((x) => x.criterios.length)) {
      filas.push([ce.codigo, "", porciento(porCe[ce.codigo])]);
      ce.criterios.forEach((k) => filas.push(["", `${k.codigo}. ${k.texto}`, porciento(pesos[k.codigo])]));
    }
    s.appendChild(el(doc, "p", "", "La calificación se obtiene de los criterios de evaluación, cada uno con el peso indicado."));
    s.appendChild(tablaDePesos(doc, ["Competencia", "Criterio de evaluación", "Peso"], filas));
  } else {
    s.appendChild(el(doc, "p", "", "La calificación se obtiene de los criterios de evaluación agrupados por competencia específica; dentro de cada competencia, sus criterios pesan lo mismo salvo lo indicado en el apartado c)."));
    s.appendChild(tablaDePesos(doc, ["Competencia específica", "Peso en la calificación"], Object.entries(pesos).map(([c, v]) => [c, porciento(v)])));
  }
  const suma = Math.round(sumaDePesos(pesos) * 10) / 10;
  if (suma !== 100) s.appendChild(el(doc, "p", "rc-doc__falta", `Los pesos suman ${suma} %, no 100 %.`));
}

function texto(doc, s, valor) {
  const t = String(valor || "").trim();
  if (!t) { s.appendChild(el(doc, "p", "rc-doc__falta", "Sin redactar.")); return; }
  t.split(/\n{2,}/).forEach((parrafo) => s.appendChild(el(doc, "p", "rc-doc__p", parrafo)));
}

// IMPRIMIR: una copia del documento, suelta en <body>, y el CSS de
// impresión esconde todo lo demás. Imprimirlo en su sitio no vale: el
// panel tiene contenedores con altura y scroll propios que cortan el papel.
//
// SIN LA URL Y LA FECHA DEL NAVEGADOR (Jorge, 24/9: su PDF de Safari salía
// con "https://www.tutordigital.app/…" arriba y abajo de cada página). El
// navegador las pinta en el margen de la página; con `@page { margin: 0 }`
// no tiene dónde. El margen lo pone entonces una tabla: su cabecera y su pie
// (thead/tfoot) se REPITEN en cada página impresa en Chrome, Safari y
// Firefox, así que hacen de margen de arriba y de abajo en todas, y de paso
// llevan una línea con qué documento es.
function marcoDeImpresion(doc, hoja, { arriba = "", abajo = "" }) {
  const tabla = el(doc, "table", "rc-doc-marco");
  const fila = (etiqueta, clase, texto) => {
    const grupo = el(doc, etiqueta);
    const tr = el(doc, "tr");
    const td = el(doc, "td", clase);
    if (texto) td.appendChild(el(doc, "div", "rc-doc-marco__texto", texto));
    tr.appendChild(td);
    grupo.appendChild(tr);
    return grupo;
  };
  const cuerpo = el(doc, "tbody");
  const tr = el(doc, "tr");
  const td = el(doc, "td", "rc-doc-marco__cuerpo");
  td.appendChild(hoja.cloneNode(true));
  tr.appendChild(td);
  cuerpo.appendChild(tr);
  tabla.append(fila("thead", "rc-doc-marco__arriba", arriba), fila("tfoot", "rc-doc-marco__abajo", abajo), cuerpo);
  return tabla;
}

export function imprimir(doc, hoja, lineas = {}) {
  const body = doc.body;
  const copia = el(doc, "div", "rc-doc-impresion");
  copia.appendChild(marcoDeImpresion(doc, hoja, lineas));
  body.appendChild(copia);
  // En <html> también: html y body tienen altura fija y scroll propio en el
  // panel, y así solo saldría una página.
  body.classList.add("rc-imprime-doc");
  doc.documentElement.classList.add("rc-imprime-doc");
  const quitar = () => {
    body.classList.remove("rc-imprime-doc");
    doc.documentElement.classList.remove("rc-imprime-doc");
    copia.remove();
  };
  const win = doc.defaultView;
  if (win?.print) {
    win.addEventListener?.("afterprint", quitar, { once: true });
    win.print();
  } else {
    quitar();
  }
}

export function pintarDocumento({ contenedor, curriculo, datos, cabecera, centro = "", doc = document }) {
  const hoja = el(doc, "article", "rc-doc");
  const portada = el(doc, "header", "rc-doc__portada");
  portada.append(
    el(doc, "p", "rc-doc__centro", centro),
    el(doc, "h1", "rc-doc__h1", "Programación didáctica"),
    el(doc, "p", "rc-doc__materia", [curriculo.materia, cabecera.curso ? `${cabecera.curso}.º ESO` : "", datos.variante].filter(Boolean).join(" · ")),
  );
  // El título por defecto repite materia y curso: entonces no se pone.
  const porDefecto = `${curriculo.materia} ${cabecera.curso}.º ESO`;
  if (cabecera.titulo && cabecera.titulo !== porDefecto) portada.appendChild(el(doc, "p", "rc-doc__sub", cabecera.titulo));
  const horas = datos.sesionesSemanales ? `${datos.sesionesSemanales} sesiones semanales · ${datos.semanas || 35} semanas` : "";
  if (horas) portada.appendChild(el(doc, "p", "rc-doc__sub", horas));
  portada.appendChild(el(doc, "p", "rc-doc__ref", `Estructura según el ${REFERENCIA}.`));
  hoja.appendChild(portada);

  for (const a of APARTADOS) {
    const s = seccion(doc, a);
    if (a.letra === "a") apartadoA(doc, s, curriculo);
    else if (a.letra === "b") apartadoB(doc, s, curriculo, datos);
    else if (a.letra === "d") apartadoD(doc, s, curriculo, datos);
    else texto(doc, s, datos.textos?.[a.letra]);
    hoja.appendChild(s);
  }

  const barra = el(doc, "div", "rc-doc__barra");
  const faltan = APARTADOS.filter((a) => a.de === "texto" && !String(datos.textos?.[a.letra] || "").trim()).map((a) => a.letra);
  barra.append(
    el(doc, "p", faltan.length ? "rc-ban" : "rc-ban rc-ban--ok",
      faltan.length ? `Faltan por redactar: ${faltan.map((l) => `${l})`).join(", ")}.` : "Todos los apartados tienen contenido."),
    boton(doc, "Imprimir o guardar en PDF", {
      clase: "rc-btn--pri",
      onClick: () => imprimir(doc, hoja, {
        arriba: ["Programación didáctica", curriculo.materia, cabecera.curso ? `${cabecera.curso}.º ESO` : ""].filter(Boolean).join(" · "),
        abajo: centro,
      }),
    }),
  );
  contenedor.replaceChildren(barra, hoja);
  return { criterios: criteriosDe(curriculo).length };
}
