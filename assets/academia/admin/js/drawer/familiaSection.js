import { fetchFamilias, fetchAlumnos } from "../api.js";
import { buildFamiliaFields, metodoPagoLabel } from "./familia/familiaFields.js";
import { buildBuscadorFamilias } from "./familia/familiaBuscador.js";
import { buildFamiliaCompletaBlock } from "./familia/familiaCompleta.js";

function buildDatoRow(label, valor) {
  const labelEl = document.createElement("span");
  labelEl.className = "ac-field-label";
  labelEl.textContent = label;
  const valorEl = document.createElement("span");
  valorEl.textContent = valor || "—";
  return [labelEl, valorEl];
}

function buildResumenFamilia(familia) {
  const card = document.createElement("div");
  card.className = "ac-familia-existente";
  const name = document.createElement("div");
  name.className = "ac-familia-existente-name";
  name.textContent = familia?.nombre || "(sin nombre)";
  card.appendChild(name);

  const grid = document.createElement("div");
  grid.className = "ac-familia-existente-grid";
  grid.append(
    ...buildDatoRow("Email", familia?.email),
    ...buildDatoRow("Método de pago", metodoPagoLabel(familia?.metodo_pago))
  );
  card.appendChild(grid);
  return card;
}

function buildBtn(texto, claseExtra, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  btn.addEventListener("click", onClick);
  return btn;
}

function buildActionsRow(buttons) {
  const row = document.createElement("div");
  row.className = "ac-familia-acciones";
  row.append(...buttons);
  return row;
}

// La familia agrupa alumnos bajo un mismo tutor, email y método de pago
// para facturación conjunta y descuentos de hermanos. Por defecto (Opción
// A) se crea una familia nueva con esos datos; "+ Vincular a hermano/a"
// (Opción B) busca una familia ya existente y la reutiliza — su contacto
// solo se edita desde el primer hermano vinculado a ella.
//
// `familiaActual`: familia ya vinculada al alumno al abrir el drawer (null
// si es alumno nuevo o no tiene familia todavía). `getTarifaActual` lee en
// vivo la tarifa que el admin está rellenando en la sección Tarifa, para
// el bloque "Familia completa" — evita duplicar esos campos aquí.
export function buildFamiliaSection({
  familiaActual = null,
  fetchFamiliasFn = fetchFamilias,
  fetchAlumnosFn = fetchAlumnos,
  getTarifaActual,
  onFamiliaCambio,
} = {}) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "FAMILIA";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const body = document.createElement("div");
  wrap.appendChild(body);

  // Estados: "nueva" | "buscador" | "vinculado_pick" | "vinculada" | "vinculada_editar"
  let modo = familiaActual ? "vinculada" : "nueva";
  let familiaElegida = null;
  let prefillNuevaDatos = null;
  let fields = null;
  let familiaCompleta = null;

  function irANueva() {
    modo = "nueva";
    familiaElegida = null;
    onFamiliaCambio?.(null);
    render();
  }

  function abrirBuscador() {
    modo = "buscador";
    render();
  }

  function render() {
    body.innerHTML = "";
    fields = null;
    familiaCompleta = null;

    if (modo === "nueva") {
      fields = buildFamiliaFields(prefillNuevaDatos || {});
      body.appendChild(fields.wrap);
      body.appendChild(buildActionsRow([buildBtn("+ Vincular a hermano/a", "ghost", abrirBuscador)]));
      return;
    }

    if (modo === "buscador") {
      body.appendChild(buildBtn("← Crear familia nueva", "ghost", irANueva));
      const cargando = document.createElement("p");
      cargando.className = "ac-loading";
      cargando.textContent = "Cargando familias…";
      body.appendChild(cargando);
      fetchFamiliasFn()
        .then((familias) => {
          if (modo !== "buscador") return;
          cargando.remove();
          body.appendChild(
            buildBuscadorFamilias(familias, (familia) => {
              familiaElegida = familia;
              modo = "vinculado_pick";
              onFamiliaCambio?.(familia);
              render();
            })
          );
        })
        .catch(() => {
          if (modo !== "buscador") return;
          cargando.textContent = "No se pudieron cargar las familias.";
        });
      return;
    }

    if (modo === "vinculado_pick") {
      body.appendChild(buildResumenFamilia(familiaElegida));
      body.appendChild(buildActionsRow([buildBtn("Cambiar", "ghost", irANueva)]));
      familiaCompleta = buildFamiliaCompletaBlock({
        familiaId: familiaElegida.id,
        fetchAlumnosFn,
        getTarifaActual,
      });
      body.appendChild(familiaCompleta.wrap);
      return;
    }

    if (modo === "vinculada") {
      body.appendChild(buildResumenFamilia(familiaActual));
      body.appendChild(
        buildActionsRow([buildBtn("Editar familia", "ghost", () => { modo = "vinculada_editar"; render(); })])
      );
      return;
    }

    if (modo === "vinculada_editar") {
      fields = buildFamiliaFields(familiaActual || {});
      body.appendChild(fields.wrap);
    }
  }
  render();

  return {
    wrap,
    getValue: () => {
      if (modo === "nueva") return { familia_nueva: fields.getValue() };
      if (modo === "buscador") return { familia_id: null };
      if (modo === "vinculado_pick") return { familia_id: familiaElegida.id };
      if (modo === "vinculada") return { familia_id: familiaActual.id };
      // "vinculada_editar"
      return { familia_id: familiaActual.id, familia_actualizada: fields.getValue() };
    },
    // Recalcula "Familia completa" cuando cambia la tarifa del alumno nuevo
    // en la sección Tarifa — sin esto, "Total conjunto" quedaría desfasado.
    refreshTotal() {
      familiaCompleta?.refresh();
    },
    // Rellena "Crear familia nueva" con datos extraídos por OCR.
    prefillNueva(datos = {}) {
      prefillNuevaDatos = datos;
      modo = "nueva";
      familiaElegida = null;
      render();
    },
  };
}
