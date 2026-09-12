// QUÉ CUENTA COMO "INGRESO" DE UN PERÍODO. Un solo sitio.
//
// EL PROBLEMA (12/09/2026). Tres consultas distintas —el gráfico de Resumen,
// el resumen fiscal y las casillas del Modelo 130— llevaban cada una su
// `.eq("estado", "pagado")` pegado a mano. O sea: el criterio fiscal del
// negocio, repetido tres veces y sin nombre. El día que el gestor conteste
// la pregunta del devengo (ver A4 en el roadmap) había que acordarse de
// cambiarlo en los tres, y el que se quedara atrás daría un número distinto
// del de al lado en la misma pantalla.
//
// Y MIENTRAS, LA PANTALLA CALLABA LO IMPORTANTE. Con 0 recibos cobrados y
// 2.388 € emitidos, Resumen y Fiscal ponían "Ingresos: 0,00 €" sin decir que
// eran los COBRADOS. En septiembre de 2026 eso se lee como "no he ganado
// nada este año". Y de esa misma cifra sale la casilla [01] del Modelo 130,
// que es un papel que se presenta.
//
// LA REGLA, CON NOMBRE: hoy se cuenta por CAJA (lo cobrado). Es una decisión
// provisional, tomada a falta de la respuesta del gestor, y por eso vive
// aquí con su constante y su motivo en vez de estar escrita tres veces en
// tres archivos.
//
// SE DEVUELVEN LAS DOS CIFRAS, siempre: `cobrado` es la que manda en los
// cálculos y `facturado` es la que hace que la primera se entienda. Nunca se
// suman ni se mezclan — esa distinción es justo la del devengo vs caja.

// Criterio actual. Cambiar esto (y el filtro de abajo) es TODO lo que hay
// que tocar si el gestor dice devengo.
export const CRITERIO_INGRESOS = "caja";
export const ESTADO_COBRADO = "pagado";

// El filtro del criterio, aplicado a una consulta de academia_recibos ya
// acotada al período. Se pasa la query y se devuelve: así ningún llamador
// escribe el `.eq("estado", ...)` por su cuenta.
export function soloCobrados(query) {
  return query.eq("estado", ESTADO_COBRADO);
}

// Cobrado y facturado del período, en una sola pasada sobre los recibos.
// `meses` null = el año entero.
//
// Se leen los recibos UNA vez con su estado y se separa en memoria, en vez
// de hacer dos consultas: son decenas de filas por año, y así las dos cifras
// salen por definición del mismo conjunto de datos — dos consultas separadas
// son dos fotos de momentos distintos, y es justo el tipo de desajuste que
// hace que dos números de la misma pantalla no cuadren.
export async function fetchIngresosDelPeriodo(admin, tenantId, { anio, meses = null } = {}) {
  let query = admin
    .from("academia_recibos")
    .select("mes, total_neto, estado")
    .eq("tenant_id", tenantId)
    .eq("anio", anio);
  if (meses) query = query.in("mes", meses);

  const { data, error } = await query;
  if (error) return { error };

  const recibos = data || [];
  let cobrado = 0;
  let facturado = 0;
  let recibosCobrados = 0;
  const cobradoPorMes = Array(12).fill(0);

  for (const r of recibos) {
    const importe = Number(r.total_neto) || 0;
    facturado += importe;
    if (r.estado === ESTADO_COBRADO) {
      cobrado += importe;
      recibosCobrados += 1;
      if (r.mes >= 1 && r.mes <= 12) cobradoPorMes[r.mes - 1] += importe;
    }
  }

  return {
    cobrado: redondear(cobrado),
    facturado: redondear(facturado),
    // "Emitido pero no cobrado". No es una tercera cifra independiente: es la
    // resta, y se da hecha para que ninguna pantalla la calcule por su cuenta
    // y le salga un céntimo distinto por el redondeo.
    pendiente_de_cobro: redondear(facturado - cobrado),
    recibos_emitidos: recibos.length,
    recibos_cobrados: recibosCobrados,
    cobrado_por_mes: cobradoPorMes.map(redondear),
  };
}

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}
