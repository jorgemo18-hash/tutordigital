import { alumnosDelInforme } from "./alumnosDelInforme.js";
import { buildInformeCard } from "./informeCard.js";

// Tab "Informe": una card por cada alumno con informe ese mes —los activos y
// los que se dieron de baja en el mes del informe, ver alumnosDelInforme.js— — SIN filtrar además por
// tiene_sesiones aquí: un hermano sin sesiones ese mes sigue teniendo su
// card, solo que en modo "sin actividad" en vez de "generar informe" (ver
// informeCard.js). Filtrar la lista escondía cards enteras y generaba
// falsas alarmas de "esto no funciona" durante las pruebas.
// `periodoInforme`: el mes del informe, que puede no ser el del envío (ver
// assets/shared/js/periodosDeEnvio.js). Sin él, el del envío.
export function buildTabInforme(item, { mes, anio, periodoInforme, api }) {
  const informe = periodoInforme || { mes, anio };
  const wrap = document.createElement("div");
  wrap.className = "ef-tab-body";

  const alumnos = alumnosDelInforme(item);
  if (!alumnos.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Esta familia no tiene alumnos activos.";
    wrap.appendChild(p);
    return wrap;
  }

  for (const alumno of alumnos) {
    wrap.appendChild(buildInformeCard(alumno, { mes: informe.mes, anio: informe.anio, api, familiaId: item.familia_id }));
  }
  return wrap;
}
