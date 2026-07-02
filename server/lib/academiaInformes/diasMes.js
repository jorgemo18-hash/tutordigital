import { monthBounds } from "./consultas.js";

// Junta las asignaturas de una sesión (nuevo formato `asignaturas[]` con
// hasta 3 bloques, o el par suelto `asignatura`/`tema` de sesiones
// antiguas) en un único texto por campo, separado por " + " si hay varias.
function resumirAsignaturas(sesion) {
  const bloques = Array.isArray(sesion.asignaturas) && sesion.asignaturas.length
    ? sesion.asignaturas
    : sesion.asignatura
      ? [{ nombre: sesion.asignatura, tema: sesion.tema }]
      : [];
  return {
    asignatura: bloques.map((a) => a.nombre).filter(Boolean).join(" + "),
    tema: bloques.map((a) => a.tema).filter(Boolean).join(" + "),
  };
}

// Tabla de días del informe (una fila por día del mes en el PDF, ver
// generators/informe.py del microservicio): sesiones de clase con su
// asignatura/tema, ausencias marcadas, y festivos del tenant (tabla
// aparte, no son sesiones de ningún alumno en particular).
export async function fetchDiasMesYSesiones(admin, tenantId, alumnoId, { mes, anio }) {
  const { desde, hasta } = monthBounds(mes, anio);

  const [{ data: sesiones, error: sesionesErr }, { data: festivos, error: festivosErr }] = await Promise.all([
    admin
      .from("academia_sesiones")
      .select("fecha, tipo, asignatura, tema, asignaturas, comentario")
      .eq("tenant_id", tenantId)
      .eq("alumno_id", alumnoId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
    admin
      .from("academia_festivos")
      .select("fecha, descripcion")
      .eq("tenant_id", tenantId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);
  if (sesionesErr || festivosErr) return { error: sesionesErr || festivosErr };

  const dias = [];
  for (const sesion of sesiones || []) {
    const dia = Number(sesion.fecha.split("-")[2]);
    if (sesion.tipo === "ausencia") {
      dias.push({ dia, ausencia: true });
      continue;
    }
    const { asignatura, tema } = resumirAsignaturas(sesion);
    if (!asignatura) continue;
    dias.push({ dia, asignatura, tema });
  }
  for (const festivo of festivos || []) {
    dias.push({ dia: Number(festivo.fecha.split("-")[2]), festivo: festivo.descripcion || "Festivo" });
  }

  return { dias, sesiones: sesiones || [] };
}
