import { createDictado, dictadoDisponible } from "../../../shared/js/dictado.js";
import { el, boton, dificultad } from "./elementos.js";

// "CAMBIAR ESTE EJERCICIO": el diálogo sobre la hoja del diseño de Claude
// Design, con tres formas de cambiarlo:
//
//  - Otro del mismo tipo, con otros números (lo de siempre: misma batería).
//  - Pedir algo concreto, escrito o dictado. Lo interpreta la IA, pero solo
//    ELIGE un tipo del catálogo: los números y las soluciones los pone el
//    generador (ver server/lib/generadorEjercicios/interpretePedido.js).
//  - Elegir del catálogo, de la lista de tipos del objetivo.
//
// El MISMO diálogo sirve para AÑADIR un ejercicio al final (`modo: "anadir"`,
// sin `hueco`): las tres formas son las mismas, cambian los textos.
//
// El diálogo no llama a nada: avisa a la pantalla con lo elegido
// (`onAzar`, `onClave`, `onPedido`) y la pantalla decide. `onPedido` recibe
// la conversación (una aclaración son dos o tres turnos) y devuelve
// `{ hecho: true }` o `{ pregunta, opciones }` o `{ aviso }`.
function opcion(doc, { titulo, texto, porque, extra = null }) {
  const o = el(doc, "div", "rc-opt");
  o.tabIndex = 0;
  o.setAttribute("role", "radio");
  const cuerpo = el(doc, "div");
  cuerpo.append(el(doc, "b", "", titulo), el(doc, "p", "", texto));
  if (extra) cuerpo.appendChild(extra);
  if (porque) cuerpo.appendChild(el(doc, "div", "rc-opt__why", porque));
  o.append(el(doc, "div", "rc-opt__rd"), cuerpo);
  return o;
}

// Si las baterías son de varios objetivos (al añadir: el objetivo y su
// repaso), van agrupadas con el título de cada uno.
function listaDelCatalogo(doc, baterias, actual, onElegir) {
  const lista = el(doc, "div", "rc-cat");
  const variosObjetivos = new Set(baterias.map((b) => b.objetivo).filter(Boolean)).size > 1;
  let grupo = null;
  for (const b of baterias) {
    if (variosObjetivos && b.objetivo !== grupo) {
      grupo = b.objetivo;
      lista.appendChild(el(doc, "div", "rc-cat__grupo", b.tituloObjetivo ? `${b.objetivo}. ${b.tituloObjetivo}` : `Objetivo ${b.objetivo}`));
    }
    const fila = el(doc, "button", "rc-cat__fila");
    fila.type = "button";
    fila.dataset.clave = b.clave;
    fila.append(el(doc, "span", "rc-cat__nombre", b.nombre), dificultad(doc, b.dificultad, { corto: true }));
    if (b.clave === actual) fila.appendChild(el(doc, "span", "rc-cat__ahora", "el de ahora"));
    fila.addEventListener("click", () => onElegir(b.clave, fila));
    lista.appendChild(fila);
  }
  return lista;
}

const TEXTOS = {
  cambiar: {
    titulo: "Cambiar este ejercicio",
    aceptar: "Cambiar el ejercicio",
    ocupado: "Cambiando…",
    azar: "Otro del mismo tipo, con otros números",
    porqueAzar: "Se mantienen el tipo, el concepto y la dificultad: la hoja no pierde su progresión.",
    placeholder: "Por ejemplo: uno de restas con paréntesis, más fácil",
    vacio: "Escribe o dicta lo que quieres en este hueco.",
  },
  anadir: {
    titulo: "Añadir un ejercicio",
    aceptar: "Añadir el ejercicio",
    ocupado: "Añadiendo…",
    azar: "Uno del objetivo, al azar",
    porqueAzar: "Primero los tipos que aún no están en la hoja.",
    placeholder: "Por ejemplo: uno de ordenar números de menor a mayor",
    vacio: "Escribe o dicta el ejercicio que quieres añadir.",
  },
};

export function abrirDialogoCambiar({
  orden, hueco = null, resumen, baterias, onAzar, onClave, onPedido, onCerrar = () => {},
  modo: tipoDeDialogo = "cambiar", doc = document, win = globalThis.window,
}) {
  const T = TEXTOS[tipoDeDialogo] || TEXTOS.cambiar;
  const ovl = el(doc, "div", "rc rc-ovl");
  const modal = el(doc, "div", "rc-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", `${T.titulo} (${orden})`);

  const mh = el(doc, "div", "rc-modal__h");
  mh.append(el(doc, "div", "rc-crumb", `Ejercicio ${orden}`), el(doc, "h2", "", T.titulo), el(doc, "div", "rc-sub", resumen));

  const texto = el(doc, "textarea", "rc-ta");
  texto.rows = 2;
  texto.placeholder = T.placeholder;
  const mic = boton(doc, "Dictar", { clase: "rc-btn--sm" });
  mic.hidden = !dictadoDisponible(win);
  const filaTexto = el(doc, "div", "rc-opt__texto");
  filaTexto.append(texto, mic);

  let claveElegida = null;
  const catalogo = listaDelCatalogo(doc, baterias, hueco?.clave, (clave, fila) => {
    claveElegida = clave;
    for (const f of catalogo.querySelectorAll(".rc-cat__fila")) f.classList.toggle("is-on", f === fila);
    elegir("catalogo");
  });

  const detalle = hueco
    ? [hueco.nombre, hueco.concepto, hueco.dificultad ? `dificultad ${hueco.dificultad}` : null].filter(Boolean).join(" · ")
    : "Un tipo de ejercicio de este objetivo o de sus anteriores.";
  const opciones = {
    azar: opcion(doc, {
      titulo: T.azar,
      texto: detalle,
      porque: T.porqueAzar,
    }),
    pedido: opcion(doc, {
      titulo: "Pedir algo concreto",
      texto: "Descríbelo en una frase, escrito o dictado.",
      extra: filaTexto,
      porque: "La IA solo elige entre los tipos del catálogo; los números y las soluciones los pone el generador.",
    }),
    catalogo: opcion(doc, {
      titulo: "Elegir del catálogo",
      texto: tipoDeDialogo === "anadir" ? "Los tipos de este objetivo y de sus anteriores." : "Los tipos de ejercicio de este objetivo.",
      extra: catalogo,
    }),
  };
  let modo = "azar";
  function elegir(nuevo) {
    modo = nuevo;
    for (const [k, o] of Object.entries(opciones)) {
      o.classList.toggle("is-on", k === modo);
      o.setAttribute("aria-checked", String(k === modo));
    }
  }
  for (const [k, o] of Object.entries(opciones)) {
    o.addEventListener("click", (e) => { if (!e.target.closest("button, textarea")) elegir(k); });
  }
  texto.addEventListener("focus", () => elegir("pedido"));

  const mb = el(doc, "div", "rc-modal__b");
  mb.append(opciones.azar, opciones.pedido, opciones.catalogo);

  const aviso = el(doc, "p", "rc-modal__aviso");
  aviso.hidden = true;
  const cancelar = boton(doc, "Cancelar", { onClick: () => cerrar() });
  const aceptar = boton(doc, T.aceptar, { clase: "rc-btn--pri" });
  const mf = el(doc, "div", "rc-modal__f");
  mf.append(aviso, el(doc, "span", "rc-sp"), cancelar, aceptar);

  modal.append(mh, mb, mf);
  ovl.appendChild(modal);

  const conversacion = [];
  function mostrarAviso(t) {
    aviso.textContent = t || "";
    aviso.hidden = !t;
  }
  function setOcupado(si) {
    for (const c of [aceptar, cancelar, texto, mic]) c.disabled = si;
    aceptar.textContent = si ? T.ocupado : T.aceptar;
  }

  async function confirmar() {
    mostrarAviso("");
    if (modo === "azar") { onAzar(); return; }
    if (modo === "catalogo") {
      if (!claveElegida) { mostrarAviso("Elige un tipo de la lista."); return; }
      onClave(claveElegida);
      return;
    }
    const pedido = texto.value.trim();
    if (!pedido) { mostrarAviso(T.vacio); texto.focus(); return; }
    conversacion.push({ rol: "profesor", texto: pedido });
    setOcupado(true);
    try {
      const r = await onPedido([...conversacion]);
      if (r?.pregunta) {
        conversacion.push({ rol: "asistente", texto: r.pregunta });
        texto.value = "";
        mostrarAviso(r.opciones?.length ? `${r.pregunta} (${r.opciones.join(" · ")})` : r.pregunta);
      } else if (r?.aviso) {
        conversacion.length = 0;
        mostrarAviso(r.aviso);
      }
    } finally {
      if (ovl.isConnected) setOcupado(false);
    }
  }
  aceptar.addEventListener("click", confirmar);

  const dictado = createDictado({
    win,
    onTexto: (t) => { texto.value = t; },
    onFin: () => { mic.textContent = "Dictar"; mic.classList.remove("is-on"); },
    onError: (m) => mostrarAviso(m),
  });
  mic.addEventListener("click", () => {
    elegir("pedido");
    if (dictado.activo) { dictado.parar(); return; }
    if (dictado.empezar()) { mic.textContent = "Escuchando… (parar)"; mic.classList.add("is-on"); }
  });

  function alTeclado(e) { if (e.key === "Escape") cerrar(); }
  ovl.addEventListener("click", (e) => { if (e.target === ovl) cerrar(); });
  doc.addEventListener("keydown", alTeclado);

  function cerrar() {
    if (dictado.activo) dictado.parar();
    doc.removeEventListener("keydown", alTeclado);
    ovl.remove();
    onCerrar();
  }

  elegir("azar");
  doc.body.appendChild(ovl);
  // Sin desplazar: el diálogo se abre por arriba aunque el botón esté abajo.
  aceptar.focus({ preventScroll: true });
  return { el: ovl, cerrar, setOcupado, aviso: mostrarAviso, get modo() { return modo; } };
}
