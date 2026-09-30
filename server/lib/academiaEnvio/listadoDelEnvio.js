import {
  fetchFamiliasConAlumnos, fetchRecibosDelMes, fetchAlumnosConSesionesMes, fetchInformesEnviadosMes,
} from "../academiaRecibos/consultas.js";
import { fetchUltimoEnvioPorFamilia } from "./consultasEnvios.js";
import { fetchPeriodoDelInforme } from "./consultas.js";

// Exportado para los tests: lo que se arma aquí lo lee el panel por el
// nombre de cada clave, y una clave que se renombra o se olvida no da
// ningún error — la pantalla simplemente deja de pintar ese dato. Es el
// mismo fallo silencioso que el `reply_to` que no llegaba a Resend, así que
// el viaje se comprueba de punta a punta (ver tests/academiaEnvio).
export function buildListItem({ familia, alumnosActivos, recibo, conSesiones, informesEnviados, ultimoEnvio = null }) {
  return {
    familia_id: familia.id,
    familia_nombre: familia.nombre,
    familia_email: familia.email,
    familia_metodo_pago: familia.metodo_pago,
    recibo: recibo
      ? { id: recibo.id, estado: recibo.estado, total_neto: recibo.total_neto, fecha_envio: recibo.fecha_envio }
      : null,
    alumnos_activos: alumnosActivos.map((a) => ({
      ...a,
      tiene_sesiones: conSesiones.has(a.id),
      informe_enviado_at: informesEnviados[a.id] || null,
    })),
    tiene_hermanos: alumnosActivos.length > 1,
    // El ÚLTIMO email que le mandamos a esta familia y si llegó (migración
    // 122). null = no hay ninguno registrado, que es lo normal en todo lo
    // enviado antes de que existiera este registro: la pantalla no puede
    // pintar eso como un problema. Ver consultasEnvios.js.
    envio_email: ultimoEnvio,
  };
}

// LA LISTA DE "ENVÍO A FAMILIAS" DE UN MES: cada familia con su recibo, sus
// alumnos (con sesiones e informe) y el último correo que se le mandó.
//
// `mes`/`anio` son los del RECIBO, que es el mes del envío. Las sesiones y
// los informes se miran en el mes del INFORME, que según el modo del centro
// puede ser el anterior (Jorge, 30/09/2026: "el 5 de octubre, el recibo de
// octubre y el informe de septiembre"; ver assets/shared/js/
// periodosDeEnvio.js). Se devuelve `periodoInforme` para que el panel pinte
// y pida exactamente ese mismo mes, y no lo deduzca por su cuenta.
//
// `logWarn`: el estado de entrega es información de adorno; si su consulta
// falla la lista sale igual y el fallo va al log de quien llama.
export async function fetchListadoDelEnvio(admin, tenantId, { mes, anio }, { logWarn = () => {} } = {}) {
  const [{ items, error: itemsErr }, { porFamilia, error: recibosErr }, periodoInforme] = await Promise.all([
    fetchFamiliasConAlumnos(admin, tenantId, { mes, anio }),
    fetchRecibosDelMes(admin, tenantId, { mes, anio }),
    fetchPeriodoDelInforme(admin, tenantId, { mes, anio }),
  ]);
  if (itemsErr || recibosErr) return { error: itemsErr || recibosErr };

  const alumnoIds = items.flatMap((item) => item.alumnosActivos.map((a) => a.id));
  const [{ conSesiones, error: sesionesErr }, { porAlumno: informesEnviados, error: informesErr }] = await Promise.all([
    fetchAlumnosConSesionesMes(admin, tenantId, alumnoIds, periodoInforme),
    fetchInformesEnviadosMes(admin, tenantId, alumnoIds, periodoInforme),
  ]);
  if (sesionesErr || informesErr) return { error: sesionesErr || informesErr };

  const { porFamilia: enviosPorFamilia, error: enviosErr } = await fetchUltimoEnvioPorFamilia(
    admin, tenantId, items.map((item) => item.familia.id)
  );
  if (enviosErr) logWarn({ err: enviosErr }, "estado de entrega no disponible");

  const lista = items.map((item) =>
    buildListItem({
      ...item,
      recibo: porFamilia[item.familia.id] || null,
      conSesiones,
      informesEnviados,
      ultimoEnvio: enviosPorFamilia?.[item.familia.id] || null,
    })
  );
  return { lista, periodoInforme };
}
