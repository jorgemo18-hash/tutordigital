// LOS CONTROLES DEL GENERADOR: qué objetivo, con qué intensidad, y las dos
// acciones (otra versión e imprimir).
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
  select.addEventListener("change", () => {
    estado = { ...estado, objetivo: Number(select.value) };
    onCambio(estado);
  });

  const tabs = doc.createElement("div");
  tabs.className = "ac-tabs";
  const ayuda = doc.createElement("p");
  ayuda.className = "ac-field-hint";
  const botones = new Map();
  function marcarIntensidad() {
    botones.forEach((b, id) => b.classList.toggle("active", id === estado.intensidad));
    ayuda.textContent = TEXTO_INTENSIDAD[estado.intensidad]?.ayuda || "";
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

  wrap.append(campo("Objetivo", select, doc), campo("Intensidad", intensidad, doc), acciones);

  return {
    el: wrap,
    setOcupado(ocupado) {
      [select, otra, imprimir, ...botones.values()].forEach((b) => { b.disabled = ocupado; });
    },
  };
}
