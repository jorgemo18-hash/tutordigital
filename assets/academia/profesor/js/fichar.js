import { fichar as ficharFn, fetchMiEstadoFichaje } from "./api.js";

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Autofichaje del profesor (o admin, si entra aquí a dar clase) — mismo
// concepto que autoFichajeWidget.js del panel admin, pero repetido aquí a
// propósito en vez de compartido entre las dos apps: son dos bundles
// completamente separados (assets/academia/admin/ y assets/academia/
// profesor/), sin importaciones cruzadas en todo el proyecto — seguir ese
// mismo patrón es más simple que introducir la primera dependencia entre
// ambas por un botón.
export async function renderFichar(container, { ficharFnDep = ficharFn, fetchMiEstadoFichajeFn = fetchMiEstadoFichaje } = {}) {
  container.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "ac-panel ac-fichaje-widget";

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

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "";
    try {
      await ficharFnDep(dentro ? "salida" : "entrada");
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

  panel.append(estado, btn, msg);
  container.appendChild(panel);

  try {
    const res = await fetchMiEstadoFichajeFn();
    dentro = Boolean(res.dentro);
    pintar();
    if (res.ultimoTimestamp) texto.textContent += ` desde las ${formatHora(res.ultimoTimestamp)}`;
    btn.disabled = false;
  } catch (err) {
    msg.textContent = err.message || "No se pudo comprobar tu estado.";
    msg.className = "ac-drawer-msg error";
  }
}
