import { fetchInformeExistente } from "./consultas.js";
import { fetchDiasMesYSesiones } from "./diasMes.js";

// Vista de solo lectura del informe de un alumno — días del mes (para la
// tabla) + el comentario ya guardado, si existe — usada para poblar la tab
// "Informe" al seleccionar una familia, antes de generar/editar/enviar
// nada. No escribe en BD ni llama a Claude.
export async function fetchInformePreview(admin, tenantId, alumnoId, { mes, anio }) {
  const [{ dias, sesiones, error: diasErr }, { informe, error: informeErr }] = await Promise.all([
    fetchDiasMesYSesiones(admin, tenantId, alumnoId, { mes, anio }),
    fetchInformeExistente(admin, tenantId, alumnoId, { mes, anio }),
  ]);
  if (diasErr || informeErr) return { error: diasErr || informeErr };

  return {
    dias,
    tieneSesionesClase: sesiones.some((s) => s.tipo === "clase"),
    comentario: informe?.comentario || null,
    enviadoAt: informe?.enviado_at || null,
  };
}
