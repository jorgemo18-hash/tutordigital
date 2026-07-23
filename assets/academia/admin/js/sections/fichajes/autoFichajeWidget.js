import { fichar, fetchMiEstadoFichaje } from "../../apiFichajes.js";

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Fichaje de QUIEN esté usando este panel ahora mismo (el admin o
// recepción logueados) — distinto de la vista de gestión de más abajo,
// que consulta/corrige los fichajes de OTROS trabajadores. Botón único:
// el propio estado ("dentro"/"fuera") decide si dice "Fichar entrada" o
// "Fichar salida", así no hay forma de fichar dos entradas seguidas por
// error desde aquí.
export function buildAutoFichajeWidget({ ficharFn = fichar, fetchMiEstadoFichajeFn = fetchMiEstadoFichaje } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-panel ac-fichaje-widget";

  const estado = document.createElement("div");
  estado.className = "ac-fichaje-estado";
  const punto = document.createElement("span");
  punto.className = "ac-fichaje-punto";
  const texto = document.createElement("span");
  estado.append(punto, texto);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn primary";
  btn.disabled = true;

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  let dentro = false;

  function pintar() {
    punto.className = `ac-fichaje-punto ${dentro ? "dentro" : "fuera"}`;
    texto.textContent = dentro ? "Estás dentro" : "Estás fuera";
    btn.textContent = dentro ? "Fichar salida" : "Fichar entrada";
    btn.className = `ac-btn ${dentro ? "copper" : "primary"}`;
  }

  async function cargarEstado() {
    try {
      const res = await fetchMiEstadoFichajeFn();
      dentro = Boolean(res.dentro);
      if (res.ultimoTimestamp) {
        texto.textContent += ` desde las ${formatHora(res.ultimoTimestamp)}`;
      }
      pintar();
      btn.disabled = false;
    } catch (err) {
      msg.textContent = err.message || "No se pudo comprobar tu estado.";
      msg.className = "ac-drawer-msg error";
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "";
    try {
      await ficharFn(dentro ? "salida" : "entrada");
      dentro = !dentro;
      pintar();
      msg.textContent = "✓ Fichado";
      msg.className = "ac-drawer-msg ok";
    } catch (err) {
      msg.textContent = err.message || "No se pudo fichar.";
      msg.className = "ac-drawer-msg error";
    }
    btn.disabled = false;
  });

  wrap.append(estado, btn, msg);
  cargarEstado();
  return wrap;
}
