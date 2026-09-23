// LOS CONTROLES DEL GENERADOR: qué objetivo, con qué intensidad, cuántos
// ejercicios, y las dos acciones (otra versión e imprimir).
//
// "CUÁNTOS" EMPIEZA EN AUTOMÁTICO. Jorge, el 23/9: *"que por defecto sea
// como dices, pero que haya un selector de cantidad de ejercicios"*.
// Automático = lo que quepa en los folios de la intensidad; con un número,
// la hoja lleva ese número y ocupa los folios que necesite. Solo se ofrecen
// los números que el objetivo puede dar (`maxActividades` del catálogo).
//
// Cambiar el objetivo o la intensidad genera la hoja al momento: no hay un
// botón "Generar" que olvidar pulsar. "Otra versión" es la misma petición con
// otros números.
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

export function buildControles({ catalogo, inicial, onCambio, onOtraVersion, onImprimir, doc = document }) {
  let estado = { ...inicial };
  const wrap = doc.createElement("div");
  wrap.className = "ej-controles";

  const select = doc.createElement("select");
  select.className = "ac-select";
  for (const { numero, titulo } of catalogo.objetivos) {
    const op = doc.createElement("option");
    op.value = String(numero);
    op.textContent = `${numero}. ${titulo}`;
    select.appendChild(op);
  }
  select.value = String(estado.objetivo);

  const cuantas = doc.createElement("select");
  cuantas.className = "ac-select ej-cuantas";
  const maxDe = (objetivo) => catalogo.objetivos.find((o) => o.numero === objetivo)?.maxActividades || 1;
  function opcionesDeCuantas() {
    const max = maxDe(estado.objetivo);
    // Si el número elegido ya no cabe en el objetivo nuevo, vuelve a
    // automático en vez de pedir en silencio menos de lo que dice el control.
    if (estado.actividades && estado.actividades > max) estado = { ...estado, actividades: null };
    cuantas.replaceChildren();
    const auto = doc.createElement("option");
    auto.value = "";
    auto.textContent = "Automático";
    cuantas.appendChild(auto);
    for (let n = 1; n <= max; n += 1) {
      const op = doc.createElement("option");
      op.value = String(n);
      op.textContent = String(n);
      cuantas.appendChild(op);
    }
    cuantas.value = estado.actividades ? String(estado.actividades) : "";
  }
  opcionesDeCuantas();
  cuantas.addEventListener("change", () => {
    estado = { ...estado, actividades: cuantas.value ? Number(cuantas.value) : null };
    marcarIntensidad();
    onCambio(estado);
  });

  select.addEventListener("change", () => {
    estado = { ...estado, objetivo: Number(select.value) };
    opcionesDeCuantas();
    marcarIntensidad();
    onCambio(estado);
  });

  const tabs = doc.createElement("div");
  tabs.className = "ac-tabs";
  const ayuda = doc.createElement("p");
  ayuda.className = "ac-field-hint";
  const botones = new Map();
  function marcarIntensidad() {
    botones.forEach((b, id) => b.classList.toggle("active", id === estado.intensidad));
    // Con un número elegido, la intensidad ya no decide los folios: solo
    // cuántos apartados lleva cada ejercicio. La ayuda lo dice.
    ayuda.textContent = estado.actividades
      ? `${estado.actividades} ejercicios, con los apartados de ${TEXTO_INTENSIDAD[estado.intensidad]?.etiqueta.toLowerCase()}. Ocupa los folios que necesite.`
      : TEXTO_INTENSIDAD[estado.intensidad]?.ayuda || "";
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
  marcarIntensidad();
  const intensidad = doc.createElement("div");
  intensidad.className = "ej-intensidad";
  intensidad.append(tabs, ayuda);

  const otra = boton("Otra versión", "ghost", () => onOtraVersion(estado), doc);
  const imprimir = boton("Imprimir", "primary", () => onImprimir(), doc);
  const acciones = doc.createElement("div");
  acciones.className = "ej-acciones";
  acciones.append(otra, imprimir);

  wrap.append(
    campo("Objetivo", select, doc),
    campo("Intensidad", intensidad, doc),
    campo("Ejercicios", cuantas, doc),
    acciones,
  );

  return {
    el: wrap,
    setOcupado(ocupado) {
      [select, cuantas, otra, imprimir, ...botones.values()].forEach((b) => { b.disabled = ocupado; });
    },
  };
}
