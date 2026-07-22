import { buildInformeCard } from "./informeCard.js";

// Tab "Informe": una card por cada alumno activo de la familia (ya vienen
// filtrados por activo=true desde el backend, ver alumnos_activos en
// academia-recibos/listado.routes.js) — SIN filtrar además por
// tiene_sesiones aquí: un hermano sin sesiones ese mes sigue teniendo su
// card, solo que en modo "sin actividad" en vez de "generar informe" (ver
// informeCard.js). Filtrar la lista escondía cards enteras y generaba
// falsas alarmas de "esto no funciona" durante las pruebas.
export function buildTabInforme(item, { mes, anio, api }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-tab-body";

  if (!item.alumnos_activos.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Esta familia no tiene alumnos activos.";
    wrap.appendChild(p);
    return wrap;
  }

  for (const alumno of item.alumnos_activos) {
    wrap.appendChild(buildInformeCard(alumno, { mes, anio, api }));
  }
  return wrap;
}
