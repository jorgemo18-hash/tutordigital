import { requireSessionOrRedirect } from "../../../../shared/js/guard.js";
import { fetchConfig, fetchFamilias } from "../../js/api.js";
import { createAlumnoDrawer } from "../../js/drawer/alumnoDrawer.js";

function buildCapturaButton({ icon, label, colorClass, onClick }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-captura-btn ${colorClass}`;
  const iconEl = document.createElement("span");
  iconEl.className = "ac-captura-icon";
  iconEl.textContent = icon;
  iconEl.setAttribute("aria-hidden", "true");
  btn.append(iconEl, document.createTextNode(label));
  btn.addEventListener("click", onClick);
  return btn;
}

// "Subir inscripción" no reimplementa el flujo OCR — abre el mismo drawer
// de "Nuevo alumno" del panel de escritorio y dispara su propio botón de
// subida, para que la lógica (extracción, prefill, Guardar y activar)
// viva en un único sitio.
function abrirInscripcionEnDrawer(drawer) {
  drawer.open(null);
  requestAnimationFrame(() => {
    document.querySelector(".ac-drawer-upload-btn--active")?.click();
  });
}

async function init() {
  requireSessionOrRedirect({ requireTenant: true });

  const root = document.getElementById("capturaApp");
  root.innerHTML = "";

  const gastoBtn = buildCapturaButton({
    icon: "🧾",
    label: "Subir gasto",
    colorClass: "ac-captura-cobre",
    onClick: () => window.alert("Próximamente — disponible en el módulo Finanzas."),
  });
  root.appendChild(gastoBtn);

  const [config, familias] = await Promise.all([
    fetchConfig().catch(() => ({})),
    fetchFamilias().catch(() => []),
  ]);
  const drawer = createAlumnoDrawer(document.body, { familias, config: config || {}, onSaved: () => {} });

  const inscripcionBtn = buildCapturaButton({
    icon: "📷",
    label: "Subir inscripción",
    colorClass: "ac-captura-oscuro",
    onClick: () => abrirInscripcionEnDrawer(drawer),
  });
  root.appendChild(inscripcionBtn);
}

init();
