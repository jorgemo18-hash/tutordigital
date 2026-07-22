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

function buildBtn(texto, claseExtra) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  return btn;
}

// Barra de edición sobre la vista previa: concepto, descuento puntual % y
// su nota, y "Guardar cambios" (PUT, solo en borrador). Regenerar/Enviar
// ya NO viven aquí — se consolidaron en los dos botones únicos junto al
// selector Informe/Recibo (ver acciones/accionesFamiliaBoton.js), junto
// con el resto de acciones de la familia. `onGuardar` es async — el
// editor solo gestiona su propio botón/mensaje, la llamada a la API vive
// fuera.
export function buildReciboEditor(recibo, { onGuardar }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-editor";

  const esBorrador = recibo.estado === "borrador";

  const row = document.createElement("div");
  row.className = "ef-editor-row";
  const concepto = buildField("Concepto", { type: "text", value: recibo.concepto || "" });
  const descuento = buildField("Descuento puntual (%)", {
    type: "number", min: "0", max: "100", step: "1", value: recibo.descuento_puntual_pct || 0,
  });
  const nota = buildField("Nota del descuento", { type: "text", value: recibo.descuento_puntual_nota || "" });
  row.append(concepto.wrap, descuento.wrap, nota.wrap);
  wrap.appendChild(row);

  if (!esBorrador) {
    concepto.input.disabled = true;
    descuento.input.disabled = true;
    nota.input.disabled = true;
  }

  const acciones = document.createElement("div");
  acciones.className = "ef-editor-acciones";

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  const guardarBtn = buildBtn("Guardar cambios", "primary");
  guardarBtn.disabled = !esBorrador;
  guardarBtn.addEventListener("click", async () => {
    guardarBtn.disabled = true;
    msg.textContent = "";
    try {
      await onGuardar({
        concepto: concepto.input.value.trim(),
        descuento_puntual_pct: Number(descuento.input.value) || 0,
        descuento_puntual_nota: nota.input.value.trim() || null,
      });
      msg.textContent = "✓ Guardado";
      msg.className = "ac-drawer-msg ok";
    } catch (err) {
      msg.textContent = err.message || "No se pudo guardar.";
      msg.className = "ac-drawer-msg error";
    }
    guardarBtn.disabled = false;
  });
  acciones.appendChild(guardarBtn);

  acciones.appendChild(msg);
  wrap.appendChild(acciones);
  return wrap;
}
