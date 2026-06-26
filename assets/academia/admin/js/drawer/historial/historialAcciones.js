function buildBtn(texto, claseExtra) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  return btn;
}

// Botones bajo la preview del recibo seleccionado: en borrador, "Regenerar"
// + "Enviar"; ya enviado, solo "Reenviar" (mismo endpoint de envío, no
// modifica el recibo). `onRegenerar`/`onEnviar` ya gestionan la recarga del
// historial — este componente solo gestiona sus propios botones/mensaje.
export function buildHistorialAcciones(recibo, { onRegenerar, onEnviar }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-historial-acciones";

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  async function ejecutar(btn, accionFn, textoOk) {
    btn.disabled = true;
    msg.textContent = "";
    try {
      await accionFn();
      msg.textContent = textoOk;
      msg.className = "ac-drawer-msg ok";
    } catch (err) {
      msg.textContent = err.message || "No se pudo completar la acción.";
      msg.className = "ac-drawer-msg error";
    }
    btn.disabled = false;
  }

  if (recibo.estado === "borrador") {
    const regenerarBtn = buildBtn("Regenerar", "ghost");
    regenerarBtn.addEventListener("click", () => ejecutar(regenerarBtn, onRegenerar, "✓ Recibo regenerado"));
    wrap.appendChild(regenerarBtn);

    const enviarBtn = buildBtn("Enviar", "primary");
    enviarBtn.addEventListener("click", () => ejecutar(enviarBtn, onEnviar, "✓ Enviado"));
    wrap.appendChild(enviarBtn);
  } else {
    const reenviarBtn = buildBtn("Reenviar", "primary");
    reenviarBtn.addEventListener("click", () => ejecutar(reenviarBtn, onEnviar, "✓ Reenviado"));
    wrap.appendChild(reenviarBtn);
  }

  wrap.appendChild(msg);
  return wrap;
}
