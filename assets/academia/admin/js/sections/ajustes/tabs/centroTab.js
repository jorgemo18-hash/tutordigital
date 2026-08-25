import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { buildToggle } from "../toggle.js";

const CAMPOS_IDENTIDAD = [
  { key: "nombre_emisor", label: "Nombre / Razón social" },
  { key: "dni_emisor", label: "DNI / NIF" },
  { key: "direccion_emisor", label: "Dirección" },
];

function buildField(label, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement("input");
  input.className = "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}

function buildColumnaIdentidad(config) {
  const col = document.createElement("div");
  const label = document.createElement("div");
  label.className = "ac-section-label";
  label.textContent = "Identidad";
  col.appendChild(label);

  const stack = document.createElement("div");
  stack.style.display = "flex";
  stack.style.flexDirection = "column";
  stack.style.gap = "14px";
  const inputs = {};
  for (const c of CAMPOS_IDENTIDAD) {
    const field = buildField(c.label, { type: "text", value: config[c.key] || "" });
    inputs[c.key] = field.input;
    stack.appendChild(field.wrap);
  }
  col.appendChild(stack);
  return { col, inputs };
}

function buildColumnaContacto(config) {
  const col = document.createElement("div");
  const label = document.createElement("div");
  label.className = "ac-section-label";
  label.textContent = "Contacto y cobro";
  col.appendChild(label);

  const stack = document.createElement("div");
  stack.style.display = "flex";
  stack.style.flexDirection = "column";
  stack.style.gap = "14px";

  const row = document.createElement("div");
  row.className = "ac-grid-2";
  const telefono = buildField("Teléfono", { type: "text", value: config.telefono_emisor || "" });
  const bizum = buildField("Bizum", { type: "text", value: config.bizum_emisor || "" });
  row.append(telefono.wrap, bizum.wrap);

  const email = buildField("Email", { type: "email", value: config.email_emisor || "" });
  const iban = buildField("Cuenta bancaria · IBAN", { type: "text", value: config.iban || "" });
  iban.input.style.fontFamily = "var(--mono)";
  iban.input.style.letterSpacing = "0.02em";

  stack.append(row, email.wrap, iban.wrap);
  col.appendChild(stack);
  return { col, inputs: { telefono_emisor: telefono.input, bizum_emisor: bizum.input, email_emisor: email.input, iban: iban.input } };
}

// "Datos del centro" — identidad fiscal del emisor, ya se guardaba en
// academia_config pero el panel anterior solo mostraba datos de ejemplo
// sin backend; ahora lee/escribe las columnas reales (ver migración 064 y
// academia.config.routes.js).
export function buildCentroTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid one";

  const panel = document.createElement("div");
  panel.className = "ac-panel";
  wrap.appendChild(panel);

  const panelTutor = document.createElement("div");
  panelTutor.className = "ac-panel";
  wrap.appendChild(panelTutor);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    panel.appendChild(
      buildPanelHead("Datos del centro", "Identidad fiscal del emisor. Aparece en el encabezado de todos los recibos y facturas generados.")
    );

    const cols = document.createElement("div");
    cols.className = "ac-fiscal-cols";
    const identidad = buildColumnaIdentidad(config);
    const contacto = buildColumnaContacto(config);
    cols.append(identidad.col, contacto.col);
    panel.appendChild(cols);

    const inputs = { ...identidad.inputs, ...contacto.inputs };
    const { foot, hint } = buildPanelFoot("Los cambios se reflejan en documentos nuevos");
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      const hintTextoOriginal = hint.textContent;
      try {
        await updateConfigFn(Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()])));
        hint.textContent = "✓ Guardado";
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
      setTimeout(() => { hint.textContent = hintTextoOriginal; }, 1700);
    });
    foot.appendChild(saveBtn);
    panel.appendChild(foot);

    renderPanelTutor(config);
  }

  // Panel aparte, con su propio Guardar: apagar o encender el tutor no es
  // una edición más de la identidad fiscal, y mezclarlo en el mismo botón
  // haría que corregir un IBAN pudiera activar sin querer el envío de
  // invitaciones a todos los alumnos que se den de alta después.
  function renderPanelTutor(config) {
    panelTutor.appendChild(buildPanelHead(
      "Acceso al tutor",
      "Mientras esté desactivado, dar de alta a un alumno no pide su email, no le crea cuenta y no le envía ninguna invitación. Actívalo el día que repartas el tutor a tus alumnos."
    ));

    const activo = buildToggle("Los alumnos de este centro ya usan el tutor", Boolean(config.acceso_tutor_activo));
    panelTutor.appendChild(activo.wrap);

    const { foot, hint } = buildPanelFoot();
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      const hintTextoOriginal = hint.textContent;
      try {
        await updateConfigFn({ acceso_tutor_activo: activo.input.checked });
        hint.textContent = "✓ Guardado";
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
      setTimeout(() => { hint.textContent = hintTextoOriginal; }, 1700);
    });
    foot.appendChild(saveBtn);
    panelTutor.appendChild(foot);
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return wrap;
}
