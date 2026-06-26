import { fetchDescuentosAlumno, updateDescuentosAlumno } from "../api.js";

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

// Checklist de los tipos de descuento recurrente configurados en Ajustes,
// activables por alumno — cada cambio se guarda al instante (PUT), no
// espera al botón "Guardar" del drawer. Solo tiene sentido para un alumno
// que ya existe: uno nuevo no tiene id todavía al que asociar el descuento
// (igual que el botón "Historial de recibos", ver alumnoDrawer.js).
export function buildDescuentosRecurrentesSection({ alumnoId, fetchDescuentosFn = fetchDescuentosAlumno, updateDescuentosFn = updateDescuentosAlumno }) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "DESCUENTOS RECURRENTES";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const body = document.createElement("div");
  wrap.appendChild(body);

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
    } catch (err) {
      input.checked = !input.checked;
      msg.textContent = err.message || "No se pudo guardar.";
      msg.className = "ac-drawer-msg error";
    }
    input.disabled = false;
  }

  function renderLista(items) {
    body.innerHTML = "";
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "ac-empty";
      p.textContent = "Sin descuentos configurados en Ajustes";
      body.appendChild(p);
      return;
    }
    for (const item of items) body.appendChild(buildCheckboxRow(item, guardar));
  }

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  body.appendChild(cargando);

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
