import { fetchFamiliasConAlumnos, fetchRecibosDelMes } from "../academiaRecibos/consultas.js";
import { fetchDescuentosActivosPorAlumno } from "../academiaDescuentos/consultas.js";
import { calcularTotalesFamilia } from "../academiaRecibos/totalesFamilia.js";

// LO QUE ESTÁ POR COBRAR ESTE MES Y TODAVÍA NO TIENE RECIBO.
//
// EL PROBLEMA (Jorge, 12/09/2026): *"las finanzas no se sincronizan con los
// datos de los alumnos, no me aparece nada"*. Y no era un problema de
// sincronización: la vista "Pendientes" se construye desde
// `academia_recibos`, Lyceo no tiene ni un recibo emitido —cero, de ningún
// mes— y por tanto septiembre no tenía nada que enseñar.
//
// LO QUE DE VERDAD FALLABA ERA EL MENSAJE. Las cuatro tarjetas decían "Sin
// alumnos con este método de pago", que es FALSO: había 13 domiciliados, 6
// de Bizum, 5 en efectivo y 1 por transferencia, cada uno con su tarifa. Lo
// que no existía era el lote de recibos. Una pantalla de dinero que dice que
// no hay datos cuando lo que falta es una acción tuya no es un hueco vacío:
// es una pantalla que miente, y cuesta media hora de buscar un fallo que no
// está.
//
// LA REGLA ES LA DEL LOTE, NO UNA PARECIDA. Se pregunta exactamente lo que
// `generarParaFamiliasSinRecibo` pregunta antes de emitir: familia activa,
// con alumnos activos, y sin recibo de ese mes. Si algún día el lote cambia
// de criterio, esto cambia con él porque llama a las mismas funciones. Una
// previsión que no coincide con lo que luego se emite es peor que ninguna.
//
// NO ESCRIBE NADA. Es el mismo principio que la vista previa de los recibos:
// se puede mirar lo que se va a cobrar sin dejar rastro ni ensuciar los
// datos.
//
// Y SE DEVUELVE APARTE, nunca mezclado con los recibos emitidos. La
// distinción entre "esto está cobrado" y "esto se va a cobrar" es fiscal
// —es justo la pregunta de devengo vs caja que está pendiente con el
// gestor— así que las dos cifras no pueden vivir en el mismo saco.
export async function fetchPorEmitir(admin, tenantId, { mes, anio }) {
  const [{ items, error: itemsErr }, { porFamilia, error: recibosErr }] = await Promise.all([
    fetchFamiliasConAlumnos(admin, tenantId),
    fetchRecibosDelMes(admin, tenantId, { mes, anio }),
  ]);
  if (itemsErr || recibosErr) return { error: itemsErr || recibosErr };

  // Mismo filtro que el lote, en el mismo orden: sin alumnos activos no hay
  // recibo, y con recibo ya emitido esto no es asunto suyo.
  const sinRecibo = items.filter(
    ({ familia, alumnosActivos }) => alumnosActivos.length && !porFamilia[familia.id]
  );
  if (!sinRecibo.length) return { grupos: [], familias: 0, alumnos: 0, importe: 0 };

  const alumnoIds = sinRecibo.flatMap(({ alumnosActivos }) => alumnosActivos.map((a) => a.id));
  const { porAlumno: descuentosPorAlumno, error: descErr } =
    await fetchDescuentosActivosPorAlumno(admin, tenantId, alumnoIds);
  if (descErr) return { error: descErr };

  const porMetodo = new Map();
  let alumnos = 0;
  let importe = 0;

  for (const { familia, alumnosActivos } of sinRecibo) {
    const { totalNeto } = calcularTotalesFamilia({
      alumnosActivos, descuentosPorAlumno, mes, anio,
    });
    // `metodo_pago` puede ser null: una familia a la que todavía no se le ha
    // puesto forma de pago. Se agrupa como null y el frontend la saca al
    // final, en vez de perderla — es dinero por cobrar igual.
    const clave = familia.metodo_pago || null;
    const grupo = porMetodo.get(clave) || { metodo_pago: clave, familias: 0, alumnos: 0, importe: 0 };
    grupo.familias += 1;
    grupo.alumnos += alumnosActivos.length;
    grupo.importe = redondear(grupo.importe + totalNeto);
    porMetodo.set(clave, grupo);
    alumnos += alumnosActivos.length;
    importe = redondear(importe + totalNeto);
  }

  return {
    grupos: [...porMetodo.values()],
    familias: sinRecibo.length,
    alumnos,
    importe,
  };
}

// Se redondea en cada suma y no solo al final: es dinero que se va a
// comparar con el total de los recibos emitidos, y arrastrar la cola binaria
// de los flotantes es lo que hace que dos pantallas del mismo mes difieran
// en un céntimo (mismo criterio que round2 en calculos.js).
function redondear(valor) {
  return Math.round(valor * 100) / 100;
}
