import { buildSelectoresDeTema } from "../../../../../shared/generador/selectoresDeTema.js";

// LOS CONTROLES DEL GENERADOR: curso, materia y tema; objetivo; intensidad;
// cuántos ejercicios; y las dos acciones (otra versión e imprimir).
//
// Cambiar cualquier cosa genera la hoja al momento: no hay un botón
// "Generar" que olvidar pulsar. "Otra versión" es la misma petición con
// otros números.
//
// "CUÁNTOS" EMPIEZA EN AUTOMÁTICO. Jorge, el 23/9: *"que por defecto sea
// como dices, pero que haya un selector de cantidad de ejercicios"*.
// Automático = lo que quepa en los folios de la intensidad; con un número,
// la hoja lleva ese número y ocupa los folios que necesite. Solo se ofrecen
// los números que el objetivo puede dar (`maxActividades` del catálogo).
const TEXTO_INTENSIDAD = {
  repaso: { etiqueta: "Repaso", ayuda: "Un folio, pocos apartados: para quien solo falla a veces." },
  normal: { etiqueta: "Normal", ayuda: "Un folio con los apartados habituales." },
  refuerzo: { etiqueta: "Refuerzo", ayuda: "Hasta dos folios, más apartados: para quien lo lleva mal." },
};

function campo(etiqueta, control, doc) {
  const wrap = doc.createElement("label");
  wrap.className = "ac-field ej-campo";
  const span = doc.createElement("span");
  span.className = "ac-field-label";
  span.textContent = etiqueta;
  wrap.append(span, control);
  return wrap;
}

function boton(texto, clase, onClick, doc) {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = `ac-btn ${clase}`;
  b.textContent = texto;
  b.addEventListener("click", onClick);
  return b;
}

function opcion(valor, texto, doc) {
  const op = doc.createElement("option");
  op.value = valor;
  op.textContent = texto;
  return op;
}

export function buildControles({ catalogo, inicial, onCambio, onOtraVersion, onImprimir, doc = document }) {
  let estado = { ...inicial };
  const temaActual = () => catalogo.temas.find((t) => t.id === estado.temaId) || catalogo.temas[0];
  estado.temaId = temaActual().id;

  const wrap = doc.createElement("div");
  wrap.className = "ej-controles";

  // ── objetivo ──
  const objetivo = doc.createElement("select");
  objetivo.className = "ac-select ej-objetivo";
  function opcionesDeObjetivo() {
    const objetivos = temaActual().objetivos;
    if (!objetivos.some((o) => o.numero === estado.objetivo)) estado = { ...estado, objetivo: objetivos[0].numero };
    objetivo.replaceChildren(...objetivos.map((o) => opcion(String(o.numero), `${o.numero}. ${o.titulo}`, doc)));
    objetivo.value = String(estado.objetivo);
  }

  // ── cuántos ──
  const cuantas = doc.createElement("select");
  cuantas.className = "ac-select ej-cuantas";
  function opcionesDeCuantas() {
    const max = temaActual().objetivos.find((o) => o.numero === estado.objetivo)?.maxActividades || 1;
    // Si el número elegido ya no cabe en el objetivo nuevo, vuelve a
    // automático en vez de pedir en silencio menos de lo que dice el control.
    if (estado.actividades && estado.actividades > max) estado = { ...estado, actividades: null };
    cuantas.replaceChildren(opcion("", "Automático", doc));
    for (let n = 1; n <= max; n += 1) cuantas.appendChild(opcion(String(n), String(n), doc));
    cuantas.value = estado.actividades ? String(estado.actividades) : "";
  }

  // ── intensidad ──
  const tabs = doc.createElement("div");
  tabs.className = "ac-tabs";
  const ayuda = doc.createElement("p");
  ayuda.className = "ac-field-hint";
  const botones = new Map();
  function marcarIntensidad() {
    botones.forEach((b, id) => b.classList.toggle("active", id === estado.intensidad));
    // Con un número elegido, la intensidad ya no decide los folios: solo
    // cuántos apartados lleva cada ejercicio. La ayuda lo dice.
    const texto = TEXTO_INTENSIDAD[estado.intensidad];
    ayuda.textContent = estado.actividades
      ? `${estado.actividades} ejercicios, con los apartados de ${texto?.etiqueta.toLowerCase()}. Ocupa los folios que necesite.`
      : texto?.ayuda || "";
  }
  for (const id of catalogo.intensidades) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "ac-tab";
    b.dataset.intensidad = id;
    b.textContent = TEXTO_INTENSIDAD[id]?.etiqueta || id;
    b.addEventListener("click", () => {
      if (estado.intensidad === id) return;
      estado = { ...estado, intensidad: id };
      marcarIntensidad();
      onCambio(estado);
    });
    botones.set(id, b);
    tabs.appendChild(b);
  }
  const intensidad = doc.createElement("div");
  intensidad.className = "ej-intensidad";
  intensidad.append(tabs, ayuda);

  const refrescar = () => { opcionesDeObjetivo(); opcionesDeCuantas(); marcarIntensidad(); };

  const temas = buildSelectoresDeTema({
    temas: catalogo.temas,
    temaId: estado.temaId,
    doc,
    onCambio: (t) => { estado = { ...estado, temaId: t.id }; refrescar(); onCambio(estado); },
  });
  objetivo.addEventListener("change", () => {
    estado = { ...estado, objetivo: Number(objetivo.value) };
    refrescar();
    onCambio(estado);
  });
  cuantas.addEventListener("change", () => {
    estado = { ...estado, actividades: cuantas.value ? Number(cuantas.value) : null };
    marcarIntensidad();
    onCambio(estado);
  });
  refrescar();

  const otra = boton("Otra versión", "ghost", () => onOtraVersion(estado), doc);
  const imprimir = boton("PDF para imprimir", "primary", () => onImprimir(), doc);
  const acciones = doc.createElement("div");
  acciones.className = "ej-acciones";
  acciones.append(otra, imprimir);

  const filaTema = doc.createElement("div");
  filaTema.className = "ej-fila";
  filaTema.append(campo("Curso", temas.curso, doc), campo("Materia", temas.materia, doc), campo("Tema", temas.tema, doc));
  const filaHoja = doc.createElement("div");
  filaHoja.className = "ej-fila";
  filaHoja.append(
    campo("Objetivo", objetivo, doc),
    campo("Intensidad", intensidad, doc),
    campo("Ejercicios", cuantas, doc),
    acciones,
  );
  wrap.append(filaTema, filaHoja);

  const todos = [...temas.controles, objetivo, cuantas, otra, imprimir, ...botones.values()];
  return {
    el: wrap,
    estado: () => estado,
    // Poner los controles como los deja un pedido en palabras, sin generar:
    // la sección genera ella misma con el plan completo.
    // Los tipos concretos (`baterias`) no son de los controles: se quedan en
    // la sección, y cualquier cambio en un control los olvida.
    aplicar({ baterias, ...nuevo }) {
      estado = { ...estado, ...nuevo, actividades: nuevo.actividades || null };
      temas.fijar(estado.temaId);
      refrescar();
    },
    setOcupado(ocupado) { todos.forEach((b) => { b.disabled = ocupado; }); },
  };
}
