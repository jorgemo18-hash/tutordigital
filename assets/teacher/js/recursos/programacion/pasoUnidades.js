import { el, boton } from "../elementos.js";
import { saberesConId, criteriosDe, cobertura, propuestaPorBloques } from "../../../../shared/programacion/estructuraDeLaProgramacion.js";
import { botonDeIA } from "./iaEnElEditor.js";

// PASO 2: UNIDADES DIDÁCTICAS (apartado b del artículo 59.3): agrupar y
// secuenciar los saberes y los criterios del curso en unidades.
//
// Arriba, lo que falta: saberes y criterios que no están en ninguna unidad
// y cómo cuadran las sesiones. Es el "que haya de todos" de Jorge aplicado
// a la programación: no se da por buena hasta que está todo.
//
// Cada unidad se despliega para marcar sus saberes (agrupados por bloque y
// apartado) y sus criterios (por competencia). Escribir en un campo no
// repinta nada (se perdería el foco); marcar o mover sí.
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function resumenDeUnidad(u) {
  return [plural(u.sesiones || 0, "sesión", "sesiones"), plural(u.saberes.length, "saber", "saberes"),
    plural(u.criterios.length, "criterio", "criterios")].join(" · ");
}

function casilla(doc, { marcada, texto, codigo, onCambio }) {
  const l = el(doc, "label", "rc-ud__casilla");
  const c = el(doc, "input");
  c.type = "checkbox";
  c.checked = marcada;
  c.addEventListener("change", () => onCambio(c.checked));
  l.appendChild(c);
  if (codigo) l.appendChild(el(doc, "b", "rc-cur__codigo", codigo));
  l.appendChild(el(doc, "span", "", texto));
  return l;
}

function listaDeSaberes(doc, saberes, u, alternar) {
  const caja = el(doc, "div", "rc-ud__col");
  caja.appendChild(el(doc, "div", "rc-crumb", "Saberes básicos"));
  let bloque = null;
  let apartado = null;
  for (const s of saberes) {
    if (s.bloque !== bloque) {
      bloque = s.bloque;
      apartado = null;
      if (bloque) caja.appendChild(el(doc, "div", "rc-ud__grupo", bloque));
    }
    if (s.apartado + s.nombreApartado !== apartado) {
      apartado = s.apartado + s.nombreApartado;
      if (s.apartado || s.nombreApartado) caja.appendChild(el(doc, "div", "rc-ud__subgrupo", [s.apartado, s.nombreApartado].filter(Boolean).join(" ")));
    }
    caja.appendChild(casilla(doc, { marcada: u.saberes.includes(s.id), texto: s.texto, onCambio: (si) => alternar("saberes", s.id, si) }));
  }
  return caja;
}

function listaDeCriterios(doc, criterios, u, alternar) {
  const caja = el(doc, "div", "rc-ud__col");
  caja.appendChild(el(doc, "div", "rc-crumb", "Criterios de evaluación"));
  let ce = null;
  for (const k of criterios) {
    if (k.competencia !== ce) {
      ce = k.competencia;
      caja.appendChild(el(doc, "div", "rc-ud__grupo", ce));
    }
    caja.appendChild(casilla(doc, { marcada: u.criterios.includes(k.codigo), codigo: k.codigo, texto: k.texto, onCambio: (si) => alternar("criterios", k.codigo, si) }));
  }
  return caja;
}

// La propuesta de la IA sustituye las unidades (con confirmación) y queda
// marcada hasta que el profesor dice "revisado". `aviso` recuerda qué hubo
// que completarle a la IA, para decirlo.
function avisoDeLaIA(doc, { datos, arreglos, onHecho }) {
  const caja = el(doc, "div", "rc-ban rc-pg__aviso-ia");
  const extra = arreglos?.saberesAnadidos
    ? ` La IA dejó ${arreglos.saberesAnadidos} saber${arreglos.saberesAnadidos === 1 ? "" : "es"} sin unidad y se ${arreglos.saberesAnadidos === 1 ? "ha" : "han"} puesto en la de su bloque.`
    : "";
  caja.append(
    el(doc, "span", "", `Unidades propuestas por la IA: revisa títulos, orden, sesiones y qué criterios van en cada una antes de darlas por buenas.${extra}`),
    boton(doc, "Revisadas", { clase: "rc-btn--sm", onClick: () => { delete datos.ia.unidades; onHecho(); } }),
  );
  return caja;
}

export function pintarPasoUnidades({ contenedor, curriculo, datos, sesionesTotales, abiertas = new Set(), onCambio, ia = null, arreglosIA = null, doc = document }) {
  const saberes = saberesConId(curriculo);
  const criterios = criteriosDe(curriculo);
  datos.unidades = datos.unidades || [];
  const repintar = (extra = {}) => pintarPasoUnidades({ contenedor, curriculo, datos, sesionesTotales, abiertas, onCambio, ia, arreglosIA, doc, ...extra });
  const cambiado = ({ estructura = false } = {}) => {
    onCambio();
    if (estructura) repintar();
    else pintarCobertura();
  };

  const avisos = el(doc, "div", "rc-ud__cobertura");
  function pintarCobertura() {
    const cob = cobertura(curriculo, datos.unidades, { sesionesTotales });
    avisos.replaceChildren();
    const linea = el(doc, "p", cob.completa ? "rc-ban rc-ban--ok" : "rc-ban");
    linea.textContent = cob.completa
      ? `Todo programado: los ${cob.totalSaberes} saberes y los ${cob.totalCriterios} criterios del curso están en alguna unidad.`
      : `Falta por programar: ${cob.saberesSinUnidad.length} de ${cob.totalSaberes} saberes y ${cob.criteriosSinUnidad.length} de ${cob.totalCriterios} criterios no están en ninguna unidad.`;
    avisos.appendChild(linea);
    if (sesionesTotales) {
      avisos.appendChild(el(doc, "p", "rc-sub", `Sesiones: ${cob.sesiones} de ${sesionesTotales} del curso${cob.sesiones > sesionesTotales ? " (te pasas)" : ""}.`));
    }
    if (!cob.completa) {
      const det = el(doc, "details", "rc-ud__faltan");
      det.appendChild(el(doc, "summary", "", "Ver qué falta"));
      const ul = el(doc, "ul");
      for (const s of cob.saberesSinUnidad) ul.appendChild(el(doc, "li", "", `${s.apartado ? `${s.apartado} · ` : ""}${s.texto}`));
      for (const k of cob.criteriosSinUnidad) ul.appendChild(el(doc, "li", "", `Criterio ${k.codigo}: ${k.texto}`));
      det.appendChild(ul);
      if (datos.unidades.length) {
        det.appendChild(boton(doc, "Poner lo que falta en la última unidad", {
          clase: "rc-btn--sm",
          onClick: () => {
            const u = datos.unidades[datos.unidades.length - 1];
            u.saberes = [...new Set([...u.saberes, ...cob.saberesSinUnidad.map((s) => s.id)])];
            u.criterios = [...new Set([...u.criterios, ...cob.criteriosSinUnidad.map((k) => k.codigo)])];
            cambiado({ estructura: true });
          },
        }));
      }
      avisos.appendChild(det);
    }
    contenedor.querySelectorAll(".rc-ud__resumen").forEach((r) => {
      const u = datos.unidades.find((x) => x.id === r.dataset.id);
      if (u) r.textContent = resumenDeUnidad(u);
    });
  }

  const lista = el(doc, "div", "rc-ud__lista");
  datos.unidades.forEach((u, i) => {
    const det = el(doc, "details", "rc-card rc-ud");
    det.open = abiertas.has(u.id);
    det.addEventListener("toggle", () => { if (det.open) abiertas.add(u.id); else abiertas.delete(u.id); });
    const sum = el(doc, "summary", "rc-ud__cab");
    const titulo = el(doc, "span", "rc-ud__titulo", `${i + 1}. ${u.titulo || "Sin título"}`);
    const resumen = el(doc, "span", "rc-ud__resumen", resumenDeUnidad(u));
    resumen.dataset.id = u.id;
    sum.append(titulo, el(doc, "span", "rc-tag", `${u.trimestre}.º trimestre`), el(doc, "span", "rc-sp"), resumen);
    det.appendChild(sum);

    const cuerpo = el(doc, "div", "rc-ud__cuerpo");
    const campos = el(doc, "div", "rc-ud__campos");
    const inTitulo = el(doc, "input", "rc-sel rc-ud__in");
    inTitulo.value = u.titulo;
    inTitulo.placeholder = "Título de la unidad";
    inTitulo.addEventListener("input", () => { u.titulo = inTitulo.value; titulo.textContent = `${i + 1}. ${u.titulo || "Sin título"}`; cambiado(); });
    const inTrim = el(doc, "select", "rc-sel");
    for (const t of [1, 2, 3]) { const o = el(doc, "option", "", `${t}.º trimestre`); o.value = String(t); inTrim.appendChild(o); }
    inTrim.value = String(u.trimestre);
    inTrim.addEventListener("change", () => { u.trimestre = Number(inTrim.value); cambiado({ estructura: true }); });
    const inSes = el(doc, "input", "rc-sel rc-ud__sesiones");
    inSes.type = "number";
    inSes.min = "0";
    inSes.value = String(u.sesiones);
    inSes.setAttribute("aria-label", "Sesiones");
    inSes.addEventListener("input", () => { u.sesiones = Math.max(0, Number(inSes.value) || 0); cambiado(); });
    const acciones = el(doc, "div", "rc-ud__acciones");
    const mover = (a) => { const [x] = datos.unidades.splice(i, 1); datos.unidades.splice(a, 0, x); cambiado({ estructura: true }); };
    const subir = boton(doc, "↑", { clase: "rc-btn--sm", onClick: () => mover(i - 1) });
    subir.disabled = i === 0;
    subir.setAttribute("aria-label", "Subir la unidad");
    const bajar = boton(doc, "↓", { clase: "rc-btn--sm", onClick: () => mover(i + 1) });
    bajar.disabled = i === datos.unidades.length - 1;
    bajar.setAttribute("aria-label", "Bajar la unidad");
    const quitar = boton(doc, "Quitar", { clase: "rc-btn--sm rc-btn--gh", onClick: () => { datos.unidades.splice(i, 1); cambiado({ estructura: true }); } });
    acciones.append(subir, bajar, quitar);
    campos.append(inTitulo, inTrim, inSes, el(doc, "span", "rc-sub", "sesiones"), acciones);

    const alternar = (campo, id, si) => {
      const set = new Set(u[campo]);
      if (si) set.add(id); else set.delete(id);
      u[campo] = [...set];
      cambiado();
    };
    const columnas = el(doc, "div", "rc-ud__columnas");
    columnas.append(listaDeSaberes(doc, saberes, u, alternar), listaDeCriterios(doc, criterios, u, alternar));
    cuerpo.append(campos, columnas);
    det.appendChild(cuerpo);
    lista.appendChild(det);
  });

  const pie = el(doc, "div", "rc-ud__pie");
  pie.append(
    boton(doc, "+ Añadir unidad", {
      clase: "rc-btn--dash",
      onClick: () => {
        const id = `u${Date.now().toString(36)}`;
        datos.unidades.push({ id, titulo: "", trimestre: 3, sesiones: 0, saberes: [], criterios: criterios.map((k) => k.codigo) });
        abiertas.add(id);
        cambiado({ estructura: true });
      },
    }),
    boton(doc, "Proponer una por bloque", {
      clase: "rc-btn--sm",
      titulo: "Sustituye las unidades por una por cada bloque de saberes",
      onClick: () => {
        if (datos.unidades.length && !doc.defaultView?.confirm?.("Se sustituyen las unidades que hay por una por bloque. ¿Seguir?")) return;
        datos.unidades = propuestaPorBloques(curriculo, { sesionesTotales: sesionesTotales || 0 });
        cambiado({ estructura: true });
      },
    }),
  );

  if (ia) {
    const error = el(doc, "p", "rc-msg rc-msg--error");
    error.hidden = true;
    pie.append(botonDeIA(doc, {
      texto: "Proponer con IA",
      trabajando: "La IA está agrupando los saberes… (hasta un minuto)",
      onError: (m) => { error.textContent = m; error.hidden = false; },
      alPulsar: async () => {
        if (datos.unidades.length && !doc.defaultView?.confirm?.("La IA propondrá unidades nuevas y sustituirá las que hay. ¿Seguir?")) return;
        const r = await ia.proponerUnidades();
        datos.unidades = r.unidades;
        datos.ia = { ...(datos.ia || {}), unidades: new Date().toISOString() };
        abiertas.clear();
        onCambio();
        repintar({ arreglosIA: r.arreglos });
      },
    }), error);
  }
  const partes = [avisos, lista, pie];
  if (datos.ia?.unidades) {
    partes.unshift(avisoDeLaIA(doc, { datos, arreglos: arreglosIA, onHecho: () => { onCambio(); repintar({ arreglosIA: null }); } }));
  }
  contenedor.replaceChildren(...partes);
  pintarCobertura();
}
