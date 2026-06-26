import { fetchAlumnos } from "../api.js";
import { buildFamiliaFields, metodoPagoLabel } from "./familia/familiaFields.js";
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
// para facturación conjunta y descuentos de hermanos. El reposo de esta
// sección es siempre "familia seleccionada (o ninguna) + Cambiar familia"
// — elegir una existente o crear una nueva pasa por el segundo drawer
// (selectorFamiliaDrawer.js, instanciado una sola vez en alumnoDrawer.js
// y recibido aquí ya construido, nunca creado dentro de esta función:
// esta función se reconstruye en cada render() del drawer de alumno, así
// que crear el drawer apilado aquí dentro apilaría overlays huérfanos en
// el DOM en cada apertura).
//
// `familiaActual`: familia ya vinculada al alumno al abrir el drawer (null
// si es alumno nuevo o no tiene familia todavía). `getTarifaActual` lee en
// vivo la tarifa que el admin está rellenando en la sección Tarifa, para
// el bloque "Familia completa" — evita duplicar esos campos aquí.
export function buildFamiliaSection({
  familiaActual = null,
  selectorFamiliaDrawer,
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

  // Estados: "resumen" | "editar" (editar los datos de la familia YA
  // vinculada — no cambia cuál es; para eso está "Cambiar familia").
  let modo = "resumen";
  let familiaSeleccionada = familiaActual;
  let prefillCrearPendiente = null; // datos de OCR, ver prefillNueva() más abajo
  let fields = null;
  let familiaCompleta = null;

  function seleccionar(familia) {
    familiaSeleccionada = familia;
    modo = "resumen";
    onFamiliaCambio?.(familia);
    render();
  }

  function abrirSelector(modoInicial) {
    selectorFamiliaDrawer.open({ prefill: prefillCrearPendiente, onSeleccionar: seleccionar, modoInicial });
  }

  function render() {
    body.innerHTML = "";
    fields = null;
    familiaCompleta = null;

    if (modo === "editar") {
      fields = buildFamiliaFields(familiaSeleccionada || {});
      body.appendChild(fields.wrap);
      return;
    }

    // modo "resumen", sin familia: dos acciones en paralelo en vez de un
    // único "Cambiar familia" — cada una entra directa al sub-modo que le
    // corresponde del segundo drawer (ver selectorFamiliaDrawer.js).
    if (!familiaSeleccionada) {
      body.appendChild(
        buildActionsRow([
          buildBtn("Crear familia", "ghost", () => abrirSelector("crear")),
          buildBtn("Unir a familia", "ghost", () => abrirSelector("buscador")),
        ])
      );
      return;
    }

    // modo "resumen", con familia: sin cambios respecto a antes.
    body.appendChild(buildResumenFamilia(familiaSeleccionada));
    body.appendChild(
      buildActionsRow([
        buildBtn("Cambiar familia", "ghost", () => abrirSelector("buscador")),
        buildBtn("Editar familia", "ghost", () => { modo = "editar"; render(); }),
      ])
    );
    familiaCompleta = buildFamiliaCompletaBlock({
      familiaId: familiaSeleccionada.id,
      fetchAlumnosFn,
      getTarifaActual,
    });
    body.appendChild(familiaCompleta.wrap);
  }
  render();

  return {
    wrap,
    getValue: () => {
      if (modo === "editar") {
        return { familia_id: familiaSeleccionada.id, familia_actualizada: fields.getValue() };
      }
      return { familia_id: familiaSeleccionada?.id || null };
    },
    // Recalcula "Familia completa" cuando cambia la tarifa del alumno nuevo
    // en la sección Tarifa — sin esto, "Total conjunto" quedaría desfasado.
    refreshTotal() {
      familiaCompleta?.refresh();
    },
    // La familia ya no se crea de forma diferida (ver selectorFamiliaDrawer.js),
    // así que estos datos del OCR no se aplican de inmediato — quedan listos
    // para precargar el formulario la próxima vez que se abra "Cambiar
    // familia" → "Crear familia nueva".
    prefillNueva(datos = {}) {
      prefillCrearPendiente = datos;
    },
  };
}
