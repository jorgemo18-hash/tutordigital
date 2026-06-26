import { buildPeriodoSelector } from "./periodoSelector.js";

function buildBtn(texto, claseExtra) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  return btn;
}

// Cabecera de "Envío a familias": título + selector de período + botón
// generar/regenerar + botón enviar todos. Todas las dependencias (estado y
// callbacks) llegan explícitas — no lee nada del scope del orquestador.
export function buildCabecera({
  mes,
  anio,
  mesesEnviados,
  anioActualSistema,
  hayRecibosEnPeriodo,
  onCambiarPeriodo,
  onGenerar,
  onEnviarTodos,
}) {
  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Envío a familias";
  head.appendChild(title);

  const acciones = document.createElement("div");
  acciones.className = "ef-head-acciones";

  acciones.appendChild(buildPeriodoSelector({ mes, anio, mesesEnviados, anioActualSistema, onChange: onCambiarPeriodo }));

  const generarBtn = buildBtn(hayRecibosEnPeriodo ? "Regenerar recibos" : "Generar recibos", "ghost");
  generarBtn.addEventListener("click", async () => {
    generarBtn.disabled = true;
    try {
      await onGenerar();
    } finally {
      generarBtn.disabled = false;
    }
  });
  acciones.appendChild(generarBtn);

  const enviarTodosBtn = buildBtn("Enviar todos", "primary");
  enviarTodosBtn.addEventListener("click", async () => {
    enviarTodosBtn.disabled = true;
    try {
      await onEnviarTodos();
    } finally {
      enviarTodosBtn.disabled = false;
    }
  });
  acciones.appendChild(enviarTodosBtn);

  head.appendChild(acciones);
  return head;
}
