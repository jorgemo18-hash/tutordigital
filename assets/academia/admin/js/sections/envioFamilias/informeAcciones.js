function buildBtn(texto, claseExtra) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  return btn;
}

// Bloque "Enviar informe [+ recibo]" — una fila por alumno de la familia
// que tenga sesiones registradas ese mes (si no tiene sesiones, el backend
// no tiene nada que resumir, así que el botón directamente no aparece — ver
// academia.informes.routes.js). El nombre del alumno solo se muestra si hay
// más de uno con sesiones (familias con un único alumno no lo necesitan).
export function buildInformeAcciones(alumnos, { onEnviarInforme }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-informe-acciones";

  const conSesiones = alumnos.filter((a) => a.tiene_sesiones);
  if (!conSesiones.length) return wrap;

  const mostrarNombre = conSesiones.length > 1;

  for (const alumno of conSesiones) {
    const fila = document.createElement("div");
    fila.className = "ef-informe-fila";

    const textoBase = alumno.tieneRecibo ? "Enviar informe + recibo" : "Enviar informe";
    const btn = buildBtn(mostrarNombre ? `${textoBase} — ${alumno.nombre}` : textoBase, "copper");

    const msg = document.createElement("span");
    msg.className = "ac-drawer-msg";

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      msg.textContent = "";
      try {
        await onEnviarInforme(alumno);
        msg.textContent = "✓ Enviado";
        msg.className = "ac-drawer-msg ok";
      } catch (err) {
        msg.textContent = err.message || "No se pudo enviar.";
        msg.className = "ac-drawer-msg error";
      }
      btn.disabled = false;
    });

    fila.append(btn, msg);
    wrap.appendChild(fila);
  }

  return wrap;
}
