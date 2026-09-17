import { esProblemaDeEntrega } from "../../../assets/shared/js/estadosEntrega.js";

// El último email que le mandamos a cada familia, y si llegó.
//
// POR QUÉ "EL ÚLTIMO" Y NO "EL DE ESTE MES". La pantalla de envío es
// mensual, pero un rebote NO es un hecho mensual: es una propiedad de la
// dirección de esa familia. Si el email de los Ruiz no existe, no llegó el
// de septiembre, no llegará el de octubre, y lo que hay que hacer es
// corregir la dirección — no esperar a cambiar de mes para volver a verlo.
//
// Y al revés: si después del rebote se le mandó otro email y ESE sí llegó,
// el aviso tiene que desaparecer solo. De ahí que se mire únicamente el
// ÚLTIMO envío de cada familia: dice exactamente "el último email que le
// mandamos a esta familia no llegó", que es la frase que le sirve a Jorge.
//
// Esto deja fuera a propósito el histórico ("en marzo rebotó uno"). Eso
// vive en academia_email_eventos y no tiene sitio en esta pantalla.

// Un año hacia atrás: acota la consulta sin recortar nada útil. Un rebote
// de hace más de un año, con doce envíos posteriores, no puede ser el
// último de nadie.
const DIAS_HACIA_ATRAS = 365;

// La frontera de "no llegó" NO se define aquí: vive en assets/shared, que es
// el mismo módulo que usa el panel para pintarlo. Dos copias de esa línea se
// separan sin que nadie se entere.
export { esProblemaDeEntrega };

// Devuelve `{ porFamilia, error }`, donde porFamilia es
// `{ [familia_id]: { estado, motivo, enviado_at } }` con el ÚLTIMO envío de
// cada familia — llegara o no. Quien lo use decide qué pinta.
//
// El error se devuelve, no se lanza: esta información es un adorno de la
// pantalla de envío. Si falla, la pantalla tiene que seguir funcionando sin
// ella; lo que no puede pasar es que un centro no pueda mandar sus recibos
// porque la consulta del estado de entrega se cayó.
export async function fetchUltimoEnvioPorFamilia(admin, tenantId, familiaIds = []) {
  const ids = [...new Set(familiaIds.filter(Boolean))];
  if (!tenantId || !ids.length) return { porFamilia: {}, error: null };

  const desde = new Date(Date.now() - DIAS_HACIA_ATRAS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("academia_envios_email")
    .select("familia_id, estado, motivo, enviado_at")
    .eq("tenant_id", tenantId)
    .in("familia_id", ids)
    .gte("enviado_at", desde)
    .order("enviado_at", { ascending: false });

  if (error) return { porFamilia: {}, error };

  // Viene ordenado del más reciente al más antiguo, así que el PRIMERO de
  // cada familia es su último envío. Los siguientes se ignoran.
  const porFamilia = {};
  for (const fila of data || []) {
    if (!fila.familia_id || porFamilia[fila.familia_id]) continue;
    porFamilia[fila.familia_id] = {
      estado: fila.estado,
      motivo: fila.motivo || null,
      enviado_at: fila.enviado_at,
    };
  }
  return { porFamilia, error: null };
}
