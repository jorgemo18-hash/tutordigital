import { fetchAlumnos } from "../api.js";
import { buildFamiliaFields, metodoPagoLabel } from "./familia/familiaFields.js";

function buildDatoRow(label, valor) {
  const labelEl = document.createElement("span");
  labelEl.className = "ac-field-label";
  labelEl.textContent = label;
  const valorEl = document.createElement("span");
  valorEl.textContent = valor || "—";
  return [labelEl, valorEl];
}

// Familia histórica (creada antes de que el email fuera obligatorio, o
// importada sin él) sin email — informativo, nunca bloquea guardar. La
// falta de email en una familia NUEVA sí bloquea, pero eso se valida al
// crearla (ver selectorFamiliaDrawer.js), no aquí.
function buildAvisoSinEmail() {
  const aviso = document.createElement("div");
  aviso.className = "ac-banner amber ac-familia-aviso-email";
  aviso.textContent = "Esta familia no tiene email — no podrá recibir facturas ni informes hasta que se le añada uno.";
  return aviso;
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
  if (!familia?.email) card.appendChild(buildAvisoSinEmail());
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
// si es alumno nuevo o no tiene familia todavía).
// Alumno YA existente + tenía una familia distinta a la elegida ahora:
// confirmación explícita nombrando origen y destino antes de aplicar el
// cambio (en memoria — el guardado real sigue esperando al "Guardar" del
// pie del drawer, igual que el resto de esta sección). Los recibos ya
// emitidos no se tocan — la familia_id de un recibo se fija en el momento
// de generarlo (ver generarRecibo.js), cambiar la del alumno solo afecta a
// generaciones futuras.
async function confirmarCambioFamilia({ esAlumnoExistente, alumnoId, familiaOrigen, familiaDestino, fetchAlumnosFn }) {
  if (!esAlumnoExistente || !familiaOrigen || familiaOrigen.id === familiaDestino.id) return true;

  let notaOrigenVacia = "";
  try {
    const activos = await fetchAlumnosFn({ activo: true });
    // El propio alumno en cuestión todavía figura aquí con su familia_id
    // ANTERIOR (el cambio solo vive en memoria hasta Guardar) — se excluye
    // explícitamente para contar a quién le queda de verdad la familia origen.
    const quedanEnOrigen = activos.filter((a) => a.familia?.id === familiaOrigen.id && a.id !== alumnoId).length;
    if (quedanEnOrigen === 0) {
      notaOrigenVacia = ` La familia "${familiaOrigen.nombre}" se quedará sin alumnos activos vinculados.`;
    }
  } catch {
    // Informativo, no crítico — si falla la comprobación, se sigue sin la nota.
  }

  return window.confirm(
    `¿Mover este alumno de la familia "${familiaOrigen.nombre}" a "${familiaDestino.nombre}"? ` +
    `Los recibos ya emitidos no se ven afectados — solo aplica a partir de ahora.${notaOrigenVacia}`
  );
}

export function buildFamiliaSection({
  familiaActual = null,
  esAlumnoExistente = false,
  alumnoId = null,
  selectorFamiliaDrawer,
  fetchAlumnosFn = fetchAlumnos,
  onFamiliaCambio,
} = {}) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "FAMILIA *";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const body = document.createElement("div");
  wrap.appendChild(body);

  // Error inline al intentar guardar sin familia asignada — lo dispara
  // alumnoDrawer.js vía showError() antes de hacer scroll hasta wrap.
  const errorEl = document.createElement("p");
  errorEl.className = "ac-section-error hidden";
  wrap.appendChild(errorEl);

  // Estados: "resumen" | "editar" (editar los datos de la familia YA
  // vinculada — no cambia cuál es; para eso está "Cambiar familia").
  let modo = "resumen";
  let familiaSeleccionada = familiaActual;
  let prefillCrearPendiente = null; // datos de OCR, ver prefillNueva() más abajo
  let fields = null;

  async function seleccionar(familia) {
    const confirmado = await confirmarCambioFamilia({
      esAlumnoExistente,
      alumnoId,
      familiaOrigen: familiaSeleccionada,
      familiaDestino: familia,
      fetchAlumnosFn,
    });
    if (!confirmado) return;

    familiaSeleccionada = familia;
    modo = "resumen";
    onFamiliaCambio?.(familia);
    render();
  }

  function abrirSelector(modoInicial) {
    selectorFamiliaDrawer.open({ prefill: prefillCrearPendiente, onSeleccionar: seleccionar, modoInicial });
  }

  function render() {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    body.innerHTML = "";
    fields = null;

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
    // El desglose económico de la familia (tarifa + descuentos + subtotal
    // por alumno) ya no se pinta aquí — vive solo en "Familia — foto
    // económica" (economicoFamiliaSection.js), para no mostrar dos totales
    // distintos de la misma familia (ver familiaCompleta.js, eliminado).
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
    // La familia ya no se crea de forma diferida (ver selectorFamiliaDrawer.js),
    // así que estos datos del OCR no se aplican de inmediato — quedan listos
    // para precargar el formulario la próxima vez que se abra "Cambiar
    // familia" → "Crear familia nueva".
    prefillNueva(datos = {}) {
      prefillCrearPendiente = datos;
    },
    // Mensaje en rojo bajo la sección — alumnoDrawer.js lo llama al
    // intentar guardar sin familia asignada, junto con un scroll a wrap.
    showError(texto) {
      errorEl.textContent = texto;
      errorEl.classList.remove("hidden");
    },
    clearError() {
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    },
  };
}
