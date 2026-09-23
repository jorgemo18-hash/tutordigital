import { el, boton, etiqueta } from "./elementos.js";

// "HOJAS RECIENTES": las últimas que imprimió el profesor, con su código,
// para volver a imprimirlas sin rehacerlas (diseño de Claude Design, 23/9).
// Abrir una la pone en el generador tal como se imprimió: si no se toca,
// el PDF sale con el mismo código.
function fecha(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function pintarHojasRecientes({ contenedor, hojas, abierta = null, onAbrir, doc = document }) {
  const cab = el(doc, "div", "rc-chd");
  cab.append(el(doc, "h2", "", "Hojas recientes"), el(doc, "span", "rc-sp"), el(doc, "span", "rc-sub", "Las que has imprimido"));
  if (!hojas?.length) {
    contenedor.replaceChildren(cab, el(doc, "p", "rc-recientes__vacio", "Todavía no has imprimido ninguna. Cada hoja que imprimas quedará aquí con su código."));
    return;
  }
  const lista = el(doc, "div", "rc-recientes");
  for (const h of hojas) {
    const fila = el(doc, "div", `rc-recientes__fila${h.id === abierta ? " is-on" : ""}`);
    fila.dataset.id = h.id;
    const texto = el(doc, "div", "rc-recientes__texto");
    texto.append(
      el(doc, "div", "rc-recientes__titulo", h.objetivo),
      el(doc, "div", "rc-sub", [h.tema, h.curso, fecha(h.created_at)].filter(Boolean).join(" · ")),
    );
    const abrir = boton(doc, h.id === abierta ? "Abierta" : "Abrir", { clase: "rc-btn--sm", onClick: () => onAbrir(h.id) });
    abrir.disabled = h.id === abierta;
    fila.append(texto, etiqueta(doc, h.codigo, "rc-tag--mono"), abrir);
    lista.appendChild(fila);
  }
  contenedor.replaceChildren(cab, lista);
}

// La lista con sus datos: cargarlos (si falla, lista vacía: no es motivo
// para romper la pantalla) y volver a pintarla. `abierta()` dice cuál está
// en pantalla tal cual se guardó.
export function crearListaDeRecientes({ api, onAbrir, abierta = () => null, doc = document }) {
  let hojas = [];
  let contenedor = null;
  const pintar = () => {
    if (contenedor) pintarHojasRecientes({ contenedor, hojas, abierta: abierta(), onAbrir, doc });
  };
  return {
    montar(el) { contenedor = el; pintar(); },
    pintar,
    async cargar() {
      if (!api.recientes) return;
      try {
        hojas = (await api.recientes()).hojas || [];
      } catch {
        hojas = [];
      }
      pintar();
    },
  };
}
