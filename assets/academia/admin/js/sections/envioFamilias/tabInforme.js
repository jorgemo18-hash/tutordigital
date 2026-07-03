import { buildInformeCard } from "./informeCard.js";

// Tab "Informe": una card por cada alumno de la familia con sesiones ese
// mes (una familia con hermanos puede tener varias) — sin ninguno, un
// mensaje. Cada card gestiona su propio ciclo generar/editar/enviar de
// forma independiente (ver informeCard.js).
export function buildTabInforme(item, { mes, anio, api, onCambio }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-tab-body";

  const alumnosConSesiones = item.alumnos_activos.filter((a) => a.tiene_sesiones);
  if (!alumnosConSesiones.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Ningún alumno de esta familia tiene sesiones registradas este mes.";
    wrap.appendChild(p);
    return wrap;
  }

  for (const alumno of alumnosConSesiones) {
    wrap.appendChild(buildInformeCard(alumno, { mes, anio, api, onCambio }));
  }
  return wrap;
}
