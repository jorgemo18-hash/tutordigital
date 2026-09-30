import { limitesDelMes } from "../academiaRecibos/empiezaEnElMes.js";

// LOS ALUMNOS QUE SE HAN DADO DE BAJA PERO TODAVÍA TIENEN INFORME QUE RECIBIR.
//
// EL PROBLEMA (30/09/2026). El envío de octubre lleva el informe de
// septiembre. Un alumno que deja la academia al acabar septiembre se archiva
// (`activo = false`) y desde ese momento desaparecía de su familia en Envío a
// familias: su informe de septiembre —un mes entero de clases pagado— no se
// podía mandar desde allí.
//
// LA REGLA: entra en los informes de un mes quien estaba de alta al empezar
// ese mes, o sea, quien se dio de baja ese mes o después (`fecha_baja >=
// primer día`). Los inactivos SIN fecha de baja no son bajas: son altas
// pendientes de confirmar (ver migración 076) y no cuentan.
//
// Y SOLO SI TUVIERON CLASE ESE MES. En Lyceo, el 30/09/2026 había 9 bajas
// de septiembre: 8 eran fichas archivadas el día 16 sin una sola clase (una
// limpieza) y 1, Alejandra, se fue el 29 después de 9 clases. Sin este filtro
// las 8 aparecerían en Envío a familias con un informe vacío que no hay que
// mandar, y el lote de informes contaría 8 fallos por "sin sesiones".
//
// Solo cuentan para el INFORME. El recibo sigue siendo solo de los activos:
// a quien ya se ha ido no se le cobra el mes siguiente.
//
// `familiaId` (opcional) acota a una familia: es lo que usa el envío de una
// sola familia.
export async function fetchBajasDelPeriodo(admin, tenantId, periodo, { familiaId = null } = {}) {
  const { desde, hasta } = limitesDelMes(periodo.mes, periodo.anio);
  let query = admin
    .from("academia_alumnos")
    .select("id, nombre, curso, familia_id, fecha_baja")
    .eq("tenant_id", tenantId)
    .eq("activo", false)
    .gte("fecha_baja", desde);
  if (familiaId) query = query.eq("familia_id", familiaId);
  const { data, error } = await query;
  if (error) return { error };

  const candidatos = (data || []).filter((a) => a.familia_id && a.fecha_baja);
  if (!candidatos.length) return { porFamilia: {} };
  const { data: sesiones, error: sesErr } = await admin
    .from("academia_sesiones")
    .select("alumno_id")
    .eq("tenant_id", tenantId)
    .eq("tipo", "clase")
    .in("alumno_id", candidatos.map((a) => a.id))
    .gte("fecha", desde)
    .lte("fecha", hasta);
  if (sesErr) return { error: sesErr };
  const conClase = new Set((sesiones || []).map((s) => s.alumno_id));

  const porFamilia = {};
  for (const a of candidatos) {
    if (!conClase.has(a.id)) continue;
    (porFamilia[a.familia_id] ||= []).push({
      id: a.id, nombre: a.nombre, curso: a.curso, fecha_baja: a.fecha_baja, de_baja: true,
    });
  }
  return { porFamilia };
}
