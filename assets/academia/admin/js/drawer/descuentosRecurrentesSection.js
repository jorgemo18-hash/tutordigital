import { fetchDescuentosAlumno, updateDescuentosAlumno, fetchDescuentosTipo, fetchEconomicoFamilia } from "../api.js";

function buildTitleAndBody(wrap) {
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "DESCUENTOS RECURRENTES";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);
  const body = document.createElement("div");
  wrap.appendChild(body);
  return body;
}

function buildCargando() {
  const p = document.createElement("p");
  p.className = "ac-loading";
  p.textContent = "Cargando…";
  return p;
}

function buildVacio() {
  const p = document.createElement("p");
  p.className = "ac-empty";
  p.textContent = "Sin descuentos configurados en Ajustes";
  return p;
}

function buildCheckboxRow(item, onChange) {
  const row = document.createElement("label");
  row.className = "ac-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(item.activo);
  const span = document.createElement("span");
  span.textContent = `${item.concepto} (${Number(item.porcentaje).toFixed(2)}%)`;
  row.append(input, span);
  input.addEventListener("change", () => onChange(item, input));
  return row;
}

// Al MARCAR (nunca al desmarcar — el quitado es siempre individual y
// explícito, ver docs de la Tarea 2) un descuento en un alumno con hermanos
// activos, se ofrece — con confirmación explícita, nombrándolos — aplicar
// el mismo descuento al resto. Automatizar el poner bajo confirmación,
// nunca actuar solo: si cancela, el descuento queda solo en este alumno.
// `getFamiliaId` es un getter en vivo (no un valor fijo) porque la familia
// puede cambiar mientras el drawer está abierto (ver familiaSection.js).
async function propagarSiCorresponde(item, { alumnoId, getFamiliaId, fetchEconomicoFn, updateDescuentosFn, confirmFn }) {
  const familiaId = getFamiliaId?.();
  if (!familiaId) return;

  let economico;
  try {
    economico = await fetchEconomicoFn(familiaId);
  } catch {
    return; // informativo, no crítico — si falla la consulta, simplemente no se ofrece propagar
  }

  const hermanos = (economico?.alumnos || []).filter((a) => a.id !== alumnoId);
  if (!hermanos.length) return;

  const nombres = hermanos.map((h) => h.nombre).join(", ");
  const confirmado = confirmFn(
    `¿Aplicar "${item.concepto} (${Number(item.porcentaje).toFixed(2)}%)" también a los otros ${hermanos.length} alumnos de la familia? (${nombres})`
  );
  if (!confirmado) return;

  await Promise.all(hermanos.map((h) => updateDescuentosFn(h.id, [{ descuento_tipo_id: item.id, activo: true }])));
}

// Checklist de los tipos de descuento recurrente configurados en Ajustes,
// activables por alumno — cada cambio se guarda al instante (PUT), no
// espera al botón "Guardar" del drawer. Para un alumno que ya existe (uno
// nuevo todavía no tiene id al que asociar el descuento — ver
// buildDescuentosNuevoAlumno más abajo para ese caso).
export function buildDescuentosRecurrentesSection({
  alumnoId,
  getFamiliaId,
  fetchDescuentosFn = fetchDescuentosAlumno,
  updateDescuentosFn = updateDescuentosAlumno,
  fetchEconomicoFn = fetchEconomicoFamilia,
  confirmFn = (mensaje) => window.confirm(mensaje),
  onGuardado,
}) {
  const wrap = document.createElement("div");
  const body = buildTitleAndBody(wrap);

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";
  wrap.appendChild(msg);

  async function guardar(item, input) {
    input.disabled = true;
    msg.textContent = "";
    try {
      await updateDescuentosFn(alumnoId, [{ descuento_tipo_id: item.id, activo: input.checked }]);
      msg.textContent = "✓ Guardado";
      msg.className = "ac-drawer-msg ok";
      if (input.checked) {
        await propagarSiCorresponde(item, { alumnoId, getFamiliaId, fetchEconomicoFn, updateDescuentosFn, confirmFn });
      }
      // Motor único: la foto económica se repinta pidiéndosela de nuevo al
      // backend (fetchEconomicoFamilia), nunca recalculada aquí.
      onGuardado?.();
    } catch (err) {
      input.checked = !input.checked;
      msg.textContent = err.message || "No se pudo guardar.";
      msg.className = "ac-drawer-msg error";
    }
    input.disabled = false;
  }

  function renderLista(items) {
    body.innerHTML = "";
    if (!items.length) { body.appendChild(buildVacio()); return; }
    for (const item of items) body.appendChild(buildCheckboxRow(item, guardar));
  }

  body.appendChild(buildCargando());
  fetchDescuentosFn(alumnoId)
    .then((items) => renderLista(items))
    .catch((err) => {
      body.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudieron cargar los descuentos.";
      body.appendChild(p);
    });

  return { wrap };
}

// Mismo checklist visual para un alumno todavía sin guardar: las
// selecciones solo se quedan en memoria (no hay alumnoId al que asociarlas
// todavía) — alumnoDrawer.js lee getSeleccionados() tras crear el alumno y
// hace el PUT con el id ya asignado, en la misma acción de "Guardar".
export function buildDescuentosNuevoAlumno({ fetchTiposFn = fetchDescuentosTipo } = {}) {
  const wrap = document.createElement("div");
  const body = buildTitleAndBody(wrap);

  const seleccionados = new Set();
  function onChange(item, input) {
    if (input.checked) seleccionados.add(item.id);
    else seleccionados.delete(item.id);
  }

  function renderLista(tipos) {
    body.innerHTML = "";
    if (!tipos.length) { body.appendChild(buildVacio()); return; }
    for (const tipo of tipos) body.appendChild(buildCheckboxRow({ ...tipo, activo: false }, onChange));
  }

  body.appendChild(buildCargando());
  fetchTiposFn()
    .then((tipos) => renderLista(tipos))
    .catch((err) => {
      body.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudieron cargar los descuentos.";
      body.appendChild(p);
    });

  return {
    wrap,
    getSeleccionados: () => Array.from(seleccionados).map((id) => ({ descuento_tipo_id: id, activo: true })),
  };
}
