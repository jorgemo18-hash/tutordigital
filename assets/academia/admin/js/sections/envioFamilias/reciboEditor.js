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

// Barra de edición sobre la vista previa: concepto, descuento puntual % y su
// nota, "Guardar cambios" (PUT), "Regenerar" (solo en borrador) y
// "Enviar a [email]" (POST) o un aviso si la familia no tiene email.
// `onGuardar`/`onEnviar`/`onRegenerar` son async — el editor solo gestiona
// sus propios botones/mensaje, la llamada a la API vive fuera.
export function buildReciboEditor(recibo, { onGuardar, onEnviar, onRegenerar }) {
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

  const guardarBtn = buildBtn("Guardar cambios", "ghost");
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

  if (esBorrador) {
    const regenerarBtn = buildBtn("Regenerar", "ghost");
    regenerarBtn.addEventListener("click", async () => {
      regenerarBtn.disabled = true;
      msg.textContent = "";
      try {
        await onRegenerar();
        msg.textContent = "✓ Recibo regenerado";
        msg.className = "ac-drawer-msg ok";
      } catch (err) {
        msg.textContent = err.message || "No se pudo regenerar.";
        msg.className = "ac-drawer-msg error";
      }
      regenerarBtn.disabled = false;
    });
    acciones.appendChild(regenerarBtn);
  }

  if (recibo.familia?.email) {
    const enviarBtn = buildBtn(`Enviar a ${recibo.familia.email}`, "primary");
    enviarBtn.addEventListener("click", async () => {
      enviarBtn.disabled = true;
      msg.textContent = "";
      try {
        await onEnviar();
        msg.textContent = "✓ Enviado";
        msg.className = "ac-drawer-msg ok";
      } catch (err) {
        msg.textContent = err.message || "No se pudo enviar.";
        msg.className = "ac-drawer-msg error";
      }
      enviarBtn.disabled = false;
    });
    acciones.appendChild(enviarBtn);
  } else {
    const aviso = document.createElement("span");
    aviso.className = "ac-drawer-msg error";
    aviso.textContent = "La familia no tiene email — no se puede enviar.";
    acciones.appendChild(aviso);
  }

  acciones.appendChild(msg);
  wrap.appendChild(acciones);
  return wrap;
}
