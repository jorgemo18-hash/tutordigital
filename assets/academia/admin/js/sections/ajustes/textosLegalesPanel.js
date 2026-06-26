import { buildIcon } from "../../icons.js";
import { fetchTextosLegales, createTextoLegal, updateTextoLegal, deleteTextoLegal } from "../../api.js";
import { buildPanelHead } from "./panelChrome.js";

const BADGES = [
  { value: "recibos", label: "Recibos" },
  { value: "email", label: "Email" },
];

function badgeLabel(value) {
  return BADGES.find((b) => b.value === value)?.label || value;
}

// Una fila por texto: etiqueta editable inline, badge (select) y contenido
// (textarea) — cada cambio se guarda al perder el foco (blur), sin botón
// "Guardar" por fila (el guardado por fila evita perder cambios de otras
// filas al pulsar "Guardar" general, que aquí no existe).
function buildFila(texto, { onActualizar, onEliminar }) {
  const item = document.createElement("div");
  item.className = "ac-legal-item";

  const head = document.createElement("div");
  head.className = "ac-legal-head";
  const etiqueta = document.createElement("input");
  etiqueta.className = "ac-legal-tag-input";
  etiqueta.value = texto.etiqueta;
  etiqueta.addEventListener("blur", () => {
    if (etiqueta.value.trim() && etiqueta.value.trim() !== texto.etiqueta) {
      onActualizar({ ...texto, etiqueta: etiqueta.value.trim() });
    }
  });

  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "ac-legal-badge";
  badge.title = "Toca para cambiar entre Recibos/Email";
  badge.textContent = badgeLabel(texto.badge);
  badge.addEventListener("click", () => {
    onActualizar({ ...texto, badge: texto.badge === "recibos" ? "email" : "recibos" });
  });

  const eliminarBtn = document.createElement("button");
  eliminarBtn.type = "button";
  eliminarBtn.className = "ac-icon-btn danger";
  eliminarBtn.title = "Eliminar";
  eliminarBtn.appendChild(buildIcon("trash", { size: 14 }));
  eliminarBtn.addEventListener("click", () => onEliminar(texto));

  head.append(etiqueta, badge, eliminarBtn);

  const contenido = document.createElement("textarea");
  contenido.className = "ac-textarea";
  contenido.rows = 2;
  contenido.value = texto.contenido || "";
  contenido.addEventListener("blur", () => {
    if (contenido.value !== texto.contenido) onActualizar({ ...texto, contenido: contenido.value });
  });

  item.append(head, contenido);
  return item;
}

// Repositorio libre de textos legales (LOPD, exenciones, avisos de
// impago...) — guardado simple por tenant, sin asignación automática a
// ningún documento todavía (eso sería una tarea aparte: decidir qué texto
// se inyecta en qué plantilla). texto_lopd/texto_exencion_iva siguen
// siendo los campos reales que sí se usan en recibos y emails (ver
// personalizacionPanel.js y facturacionTab.js) — esto es solo un archivo
// de referencia adicional para el admin.
export function buildTextosLegalesPanel({
  fetchTextosLegalesFn = fetchTextosLegales,
  createTextoLegalFn = createTextoLegal,
  updateTextoLegalFn = updateTextoLegal,
  deleteTextoLegalFn = deleteTextoLegal,
} = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Textos legales", "Leyendas configurables (LOPD, avisos, exenciones) reutilizables en recibos y emails."));

  const listSlot = document.createElement("div");
  listSlot.className = "ac-legal-list";
  panel.appendChild(listSlot);

  let textos = [];

  function renderLista() {
    listSlot.innerHTML = "";
    if (!textos.length) {
      const empty = document.createElement("p");
      empty.className = "ac-empty";
      empty.textContent = "Sin textos legales configurados todavía.";
      listSlot.appendChild(empty);
      return;
    }
    for (const t of textos) {
      listSlot.appendChild(buildFila(t, { onActualizar: actualizar, onEliminar: eliminar }));
    }
  }

  async function actualizar(texto) {
    try {
      const guardado = await updateTextoLegalFn(texto.id, {
        etiqueta: texto.etiqueta, badge: texto.badge, contenido: texto.contenido,
      });
      textos = textos.map((t) => (t.id === guardado.id ? guardado : t));
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo guardar el texto.");
    }
  }

  async function eliminar(texto) {
    try {
      await deleteTextoLegalFn(texto.id);
      textos = textos.filter((t) => t.id !== texto.id);
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo eliminar el texto.");
    }
  }

  const footRow = document.createElement("div");
  footRow.className = "ac-panel-foot";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn ghost";
  addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir texto"));
  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    try {
      const creado = await createTextoLegalFn({ etiqueta: "Nuevo texto", badge: "recibos", contenido: "" });
      textos = [...textos, creado];
      renderLista();
    } catch (err) {
      window.alert(err.message || "No se pudo crear el texto.");
    }
    addBtn.disabled = false;
  });
  footRow.appendChild(addBtn);
  panel.appendChild(footRow);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  listSlot.appendChild(cargando);

  fetchTextosLegalesFn()
    .then((data) => { textos = data; renderLista(); })
    .catch((err) => {
      listSlot.innerHTML = "";
      const error = document.createElement("p");
      error.className = "ac-error";
      error.textContent = err.message || "No se pudieron cargar los textos legales.";
      listSlot.appendChild(error);
    });

  return panel;
}
