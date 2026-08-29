import { buildFootBtn } from "../alumnoDrawerFoot.js";

// Pie del drawer de profesor. Mismo lenguaje que el de alumno (una fila
// compacta, la acción peligrosa aparte y con confirmación inline, nunca
// window.confirm), pero con DOS acciones distintas que no hay que
// confundir:
//
//   - DAR DE BAJA: la persona deja de dar clase y su rastro se queda.
//     Es lo que toca cuando alguien se va del centro — su diario, sus
//     fichajes y sus informes siguen diciendo quién los hizo.
//   - ELIMINAR DE LA PLANTILLA: la ficha desaparece. Solo para un error
//     (ficha duplicada o creada por equivocación). El servidor lo rechaza
//     con un 409 explicando qué lo impide si esa persona ha dejado
//     cualquier rastro; ese mensaje se enseña tal cual.
//
// Un profesor ya dado de baja enseña "Reactivar" en vez de "Dar de baja".

function buildConfirm({ mensaje, confirmLabel, onConfirmar, onCancelar }) {
  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";
  const texto = document.createElement("span");
  texto.className = "ac-drawer-msg";
  texto.textContent = mensaje;
  const right = document.createElement("div");
  right.className = "ac-drawer-foot-right";
  const noBtn = buildFootBtn("No", "ghost");
  noBtn.addEventListener("click", onCancelar);
  const siBtn = buildFootBtn(confirmLabel, "danger");
  siBtn.addEventListener("click", () => onConfirmar(siBtn));
  right.append(noBtn, siBtn);
  foot.append(texto, right);
  return foot;
}

export function buildProfesorFoot(params) {
  const { profesor, onCancelar, onGuardar, onDarDeBaja, onReactivar, onEliminar } = params;
  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot ac-drawer-foot--stacked";
  const estaActivo = profesor?.is_active !== false;
  const nombre = profesor?.display_name || profesor?.email || "este profesor";

  // El pie se sustituye por la confirmación, así que `foot` queda
  // DESCONECTADO del DOM: llamar a foot.replaceWith() para volver atrás no
  // haría nada (replaceWith sobre un nodo sin padre es un no-op silencioso)
  // y el "No" dejaría la confirmación pegada en pantalla para siempre. Se
  // sustituye el nodo que SÍ está puesto, que es el de la confirmación.
  function pedirConfirmacion({ mensaje, confirmLabel, onConfirmar }) {
    let confirmacion;
    confirmacion = buildConfirm({
      mensaje,
      confirmLabel,
      onConfirmar,
      onCancelar: () => confirmacion.replaceWith(buildProfesorFoot(params)),
    });
    foot.replaceWith(confirmacion);
  }

  const cancelBtn = buildFootBtn("Cancelar", "ghost");
  cancelBtn.addEventListener("click", onCancelar);
  const saveBtn = buildFootBtn("Guardar", "primary");
  saveBtn.addEventListener("click", () => onGuardar(saveBtn));

  const bajaBtn = buildFootBtn(estaActivo ? "Dar de baja" : "Reactivar", estaActivo ? "danger" : "ghost");
  bajaBtn.addEventListener("click", () => {
    // Reactivar es benigno: un clic, sin confirmación (mismo criterio que
    // "Restaurar" en el drawer de alumno). Dar de baja sí se confirma.
    if (!estaActivo) {
      onReactivar(bajaBtn);
      return;
    }
    pedirConfirmacion({
      mensaje: `¿Dar de baja a ${nombre}? Deja de aparecer, pero se conserva su histórico.`,
      confirmLabel: "Sí, dar de baja",
      onConfirmar: onDarDeBaja,
    });
  });

  const filaSuperior = document.createElement("div");
  filaSuperior.className = "ac-drawer-foot-row";
  filaSuperior.append(bajaBtn, cancelBtn, saveBtn);

  const eliminarBtn = buildFootBtn("Eliminar de la plantilla", "danger");
  eliminarBtn.classList.add("ac-btn--block");
  eliminarBtn.addEventListener("click", () => {
    pedirConfirmacion({
      mensaje: `¿Eliminar a ${nombre}? Esto es solo para una ficha creada por error: no se puede deshacer.`,
      confirmLabel: "Sí, eliminar",
      onConfirmar: onEliminar,
    });
  });
  const filaEliminar = document.createElement("div");
  filaEliminar.className = "ac-drawer-foot-row";
  filaEliminar.appendChild(eliminarBtn);

  foot.append(filaSuperior, filaEliminar);
  return foot;
}
