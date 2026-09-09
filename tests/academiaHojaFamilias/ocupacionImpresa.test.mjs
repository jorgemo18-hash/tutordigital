// El "4/6" de cada casilla de la hoja impresa (decidido por Jorge el
// 09/09/2026, después de ver la rejilla ya con el rojo funcionando).
//
// EL HISTORIAL, porque explica las tres reglas que hay debajo. La decisión
// del 03/09 fue NO imprimir plazas: un número impreso caduca esa misma tarde
// y una hoja que se queda dos semanas en la nevera acaba mintiendo. Eso
// sigue siendo verdad y por eso el rojo se queda — una hora llena sigue
// llena semanas. Pero la casilla estaba vacía, el hueco era suyo, y los dos
// contras concretos que quedaban tienen arreglo:
//
//   1. AMBIGÜEDAD. Lo señaló Jorge: un "2" no dice si son dos dentro o dos
//      libres, y quien lo lea al revés se planta un martes creyendo que
//      tiene sitio. Se arregla con el denominador: "2/6".
//   2. "SE VE LA ACADEMIA VACÍA", que era su reparo original. En el horario
//      real de Lyceo hay cinco casillas a cero y las cinco son la fila de
//      19:30–20:30 entera. Esa fila se deja a propósito para decir hasta qué
//      hora abre el centro; cinco "0/6" seguidos dicen otra cosa muy
//      distinta. Se arregla no imprimiendo el cero.
export async function run({ test, assert }) {
  const { textoOcupacion } = await import(
    "../../server/lib/academiaHojaFamilias/rejillaHorarioPdf.js"
  );
  const { construirPayloadHojaFamilias } = await import(
    "../../server/lib/academiaHojaFamilias/payloadHojaFamilias.js"
  );
  const { buildHojaFamiliasPdfBuffer } = await import(
    "../../server/lib/academiaHojaFamilias/generarHojaFamilias.js"
  );

  const CONFIG = {
    franja_inicio: "15:30:00", franja_fin: "18:30:00", franja_duracion: 60,
    dias_laborables: [1, 2], max_alumnos_por_franja: 6,
  };
  // Lunes 15:30 con 2, martes 15:30 lleno (6), y la fila de 17:30 vacía.
  const franja = (dia, ini, fin) => ({ dia_semana: dia, hora_inicio: ini, hora_fin: fin });
  const FRANJAS = [
    ...Array.from({ length: 2 }, () => franja(1, "15:30", "16:30")),
    ...Array.from({ length: 6 }, () => franja(2, "15:30", "16:30")),
    ...Array.from({ length: 3 }, () => franja(1, "16:30", "17:30")),
  ];

  test("REGRESIÓN: lleva denominador — '2' a secas no dice si son dentro o libres", () => {
    assert.equal(textoOcupacion({ ocupacion: 2 }, 6), "2/6");
    assert.equal(textoOcupacion({ ocupacion: 6 }, 6), "6/6");
  });

  test("REGRESIÓN: el cero NO se imprime", () => {
    // Cinco '0/6' seguidos en la fila de cierre convierten "abrimos hasta
    // las ocho y media" en "aquí no viene nadie".
    assert.equal(textoOcupacion({ ocupacion: 0 }, 6), "");
    assert.equal(textoOcupacion({}, 6), "");
    assert.equal(textoOcupacion(null, 6), "");
  });

  test("REGRESIÓN: sin tope configurado tampoco se imprime", () => {
    // No hay denominador que poner, así que volvería a ser ambiguo. Mismo
    // criterio que estaCompleta(), que sin tope no marca nada.
    assert.equal(textoOcupacion({ ocupacion: 3 }, 0), "");
    assert.equal(textoOcupacion({ ocupacion: 3 }, null), "");
    assert.equal(textoOcupacion({ ocupacion: 3 }, undefined), "");
  });

  test("el payload lleva la ocupación de cada casilla y el tope del centro", () => {
    const { rejilla } = construirPayloadHojaFamilias({
      tenantNombre: "Lyceo", config: CONFIG, franjas: FRANJAS,
    });
    assert.equal(rejilla.max, 6);
    const [lun, mar] = rejilla.filas[0].celdas;
    assert.equal(lun.ocupacion, 2);
    assert.equal(mar.ocupacion, 6);
    assert.equal(mar.completo, true);
    // La fila de 17:30 no tiene a nadie: la ocupación es 0, no undefined —
    // undefined recorrería otro camino en textoOcupacion por accidente.
    assert.equal(rejilla.filas[2].celdas[0].ocupacion, 0);
  });

  test("sin tope, el payload lo dice y ninguna casilla sale completa", () => {
    const { rejilla } = construirPayloadHojaFamilias({
      tenantNombre: "Lyceo",
      config: { ...CONFIG, max_alumnos_por_franja: null },
      franjas: FRANJAS,
    });
    assert.equal(rejilla.max, 0);
    assert.equal(rejilla.hayCompletas, false);
    // La ocupación se sigue calculando: lo que falta es contra qué compararla.
    assert.equal(rejilla.filas[0].celdas[1].ocupacion, 6);
  });

  test("DE PUNTA A PUNTA: el número llega al PDF, y el cero no", async () => {
    // El PDF se genera sin comprimir a propósito (ver generarHojaFamilias.js)
    // para poder leer su texto aquí. Es lo único que demuestra que el número
    // no se queda por el camino entre el payload y el papel — que es
    // exactamente donde se perdió el rojo durante semanas.
    const datos = construirPayloadHojaFamilias({
      tenantNombre: "Lyceo", config: CONFIG, franjas: FRANJAS,
    });
    const buffer = await buildHojaFamiliasPdfBuffer(datos);
    const texto = (buffer.toString("latin1").match(/<([0-9a-fA-F]+)>/g) || [])
      .map((hex) => Buffer.from(hex.slice(1, -1), "hex").toString("latin1"))
      .join("");

    // Cuatro cuartillas por folio, así que cada dato sale cuatro veces.
    assert.equal((texto.match(/2\/6/g) || []).length, 4, "el lunes a las 15:30 tiene 2");
    assert.equal((texto.match(/6\/6/g) || []).length, 4, "el martes está lleno");
    assert.equal((texto.match(/0\/6/g) || []).length, 0, "la fila vacía no anuncia ceros");
  });
}
