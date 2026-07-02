import { fetchGastoCategorias, createGastoCategoria } from "../../apiFinanzas.js";
import { buildField } from "./campoField.js";

const OTROS = "Otros";

// "Otros" siempre al final: es el disparador del mini-formulario de
// categoría nueva, así que debe ser la última opción del selector aunque
// el backend las devuelva predefinidas+alfabético (donde "Otros" no cae al
// final por casualidad del alfabeto).
function ordenarConOtrosAlFinal(categorias) {
  const otros = categorias.filter((c) => c.nombre === OTROS);
  const resto = categorias.filter((c) => c.nombre !== OTROS);
  return [...resto, ...otros];
}

function buildAddForm({ onAñadir }) {
  const wrap = document.createElement("div");
  wrap.className = "hidden";
  wrap.style.marginTop = "8px";

  // Sin label — el placeholder ya deja claro qué va aquí. Fila flex con
  // nowrap + min-width:0 en el input: sin min-width:0 un input dentro de
  // un flex item no se encoge por debajo de su contenido y desborda el
  // ancho del drawer.
  const row = document.createElement("div");
  row.style.width = "100%";
  row.style.display = "flex";
  row.style.flexWrap = "nowrap";
  row.style.alignItems = "center";
  row.style.gap = "8px";

  const nombreInput = document.createElement("input");
  nombreInput.type = "text";
  nombreInput.className = "ac-input";
  nombreInput.maxLength = 50;
  nombreInput.placeholder = "Nueva categoría...";
  nombreInput.style.flex = "1 1 0";
  nombreInput.style.minWidth = "0";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.style.flex = "0 0 auto";
  addBtn.style.whiteSpace = "nowrap";
  addBtn.style.border = "1px solid var(--copper)";
  addBtn.style.color = "var(--copper)";
  addBtn.style.background = "transparent";
  addBtn.style.padding = "6px 12px";
  addBtn.style.borderRadius = "8px";
  addBtn.textContent = "Añadir";
  row.append(nombreInput, addBtn);

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";

  addBtn.addEventListener("click", async () => {
    const valor = nombreInput.value.trim();
    if (!valor) {
      msg.textContent = "Escribe un nombre.";
      msg.className = "ac-drawer-msg error";
      return;
    }
    addBtn.disabled = true;
    msg.textContent = "";
    try {
      await onAñadir(valor);
      nombreInput.value = "";
      msg.className = "ac-drawer-msg";
    } catch (err) {
      msg.textContent = err.message || "No se pudo añadir la categoría.";
      msg.className = "ac-drawer-msg error";
    }
    addBtn.disabled = false;
  });

  wrap.append(row, msg);
  return { wrap };
}

// Selector de categoría de gasto — carga las categorías del tenant (fijas +
// personalizadas) al construirse. Al elegir "Otros" revela un mini-
// formulario para crear una categoría nueva sobre la marcha, que se añade
// al selector y queda seleccionada automáticamente.
export function buildCategoriaSelect(valorInicial, {
  fetchGastoCategoriasFn = fetchGastoCategorias,
  createGastoCategoriaFn = createGastoCategoria,
} = {}) {
  const field = buildField("Categoría", "select");
  field.input.disabled = true;
  const cargando = document.createElement("option");
  cargando.textContent = "Cargando…";
  field.input.appendChild(cargando);

  let categoriasActuales = [];

  const addForm = buildAddForm({
    onAñadir: async (nombreNuevo) => {
      const categoria = await createGastoCategoriaFn(nombreNuevo);
      poblarOpciones([...categoriasActuales, categoria]);
      field.input.value = categoria.nombre;
    },
  });

  function refreshAddForm() {
    addForm.wrap.classList.toggle("hidden", field.input.value !== OTROS);
  }

  function poblarOpciones(categorias) {
    categoriasActuales = categorias;
    field.input.innerHTML = "";
    for (const cat of ordenarConOtrosAlFinal(categorias)) {
      const opt = document.createElement("option");
      opt.value = cat.nombre;
      opt.textContent = cat.nombre;
      field.input.appendChild(opt);
    }
    field.input.disabled = false;
    if (valorInicial && categorias.some((c) => c.nombre === valorInicial)) {
      field.input.value = valorInicial;
    }
    refreshAddForm();
  }

  field.input.addEventListener("change", refreshAddForm);

  fetchGastoCategoriasFn()
    .then(poblarOpciones)
    .catch(() => {
      field.input.innerHTML = "";
      const opt = document.createElement("option");
      opt.textContent = "No se pudieron cargar";
      field.input.appendChild(opt);
    });

  const wrap = document.createElement("div");
  wrap.append(field.wrap, addForm.wrap);

  return {
    wrap,
    getValor: () => field.input.value,
    // Usado por el OCR: la categoría sugerida solo se aplica si existe
    // entre las cargadas del tenant (dinámicas, ya no una lista fija
    // compartida con el backend) — si no, se ignora en silencio, igual
    // que antes con la lista estática.
    setValorSiExiste: (nombre) => {
      if (categoriasActuales.some((c) => c.nombre === nombre)) field.input.value = nombre;
    },
  };
}
