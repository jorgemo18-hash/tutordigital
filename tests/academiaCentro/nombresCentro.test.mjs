// LOS DOS NOMBRES DEL CENTRO (migración 121).
//
// `nombre_emisor` hacía dos trabajos: razón social en los recibos y nombre
// visible en la bandeja de entrada de las familias. Con un solo centro real
// daba igual porque los dos nombres coincidían; con "ACADEMIA RUIZ, S.L."
// no: o la factura queda informal o el email dice "S.L.".
//
// LO QUE MÁS SE VIGILA AQUÍ no es la separación en sí, es el caso de
// siempre: un centro que NO rellena el nombre comercial tiene que verse
// exactamente igual que antes de la migración. Si esa precedencia se
// invirtiera, aplicar la migración dejaría muda la firma de todos los
// emails de todos los centros de golpe, y sin ningún error.
export async function run({ test, assert }) {
  const { nombreFiscal, nombreComercial, rotuloCentro } = await import(
    "../../server/lib/academiaCentro/nombresCentro.js"
  );

  const RUIZ = { nombre_emisor: "ACADEMIA RUIZ, S.L.", nombre_comercial: "Academia Ruiz" };

  test("EL PUNTO DE TODO: el fiscal y el comercial salen distintos", () => {
    assert.equal(nombreFiscal(RUIZ), "ACADEMIA RUIZ, S.L.");
    assert.equal(nombreComercial(RUIZ), "Academia Ruiz");
  });

  test("sin nombre comercial, el comercial ES el fiscal (nada cambia al migrar)", () => {
    const config = { nombre_emisor: "Lyceo academia" };
    assert.equal(nombreComercial(config), "Lyceo academia");
    assert.equal(nombreFiscal(config), "Lyceo academia");
  });

  test("un comercial en blanco se trata como no puesto, no como nombre vacío", () => {
    // Es lo que guarda el panel cuando el admin borra el campo: "" y no
    // null. Si esto no cayera al fiscal, borrar el campo dejaría los emails
    // firmados por nadie.
    assert.equal(nombreComercial({ nombre_emisor: "Lyceo", nombre_comercial: "" }), "Lyceo");
    assert.equal(nombreComercial({ nombre_emisor: "Lyceo", nombre_comercial: "   " }), "Lyceo");
    assert.equal(nombreComercial({ nombre_emisor: "Lyceo", nombre_comercial: null }), "Lyceo");
  });

  test("el nombre del tenant es el último respaldo de los dos", () => {
    assert.equal(nombreComercial({}, "Academia del Pilar"), "Academia del Pilar");
    assert.equal(nombreFiscal({}, "Academia del Pilar"), "Academia del Pilar");
  });

  test("un centro que solo tiene comercial no se queda sin fiscal: usa el tenant", () => {
    // Caso real posible: el admin rellena "nombre comercial" y se deja la
    // razón social para luego. La cabecera de la factura no puede quedar
    // vacía, pero TAMPOCO puede rellenarse con el nombre comercial: eso
    // sería inventarse un dato fiscal.
    const config = { nombre_comercial: "Academia Ruiz" };
    assert.equal(nombreFiscal(config, "Academia Ruiz Huesca"), "Academia Ruiz Huesca");
    assert.ok(
      !nombreFiscal(config, "").includes("Academia Ruiz"),
      "sin razón social ni tenant queda vacío, no se copia el comercial"
    );
  });

  test("sin nada de nada devuelven cadena vacía, no 'TutorDigital'", () => {
    // El texto por defecto lo decide quien llama. En la cabecera de una
    // factura, "TutorDigital" sería un dato falso, no un respaldo.
    assert.equal(nombreFiscal({}, ""), "");
    assert.equal(nombreComercial({}, ""), "");
    assert.equal(nombreComercial(), "");
    assert.equal(nombreFiscal(), "");
  });

  // ── El rótulo (hoja para familias) ───────────────────────────────────
  //
  // Se diferencia del comercial SOLO en el respaldo cuando no hay nombre
  // comercial: prefiere el nombre del tenant al fiscal. Es legado, no una
  // idea distinta, y estos tests están para que siga siendo legado
  // documentado y no se "arregle" sin darse cuenta.

  test("el rótulo usa el nombre comercial cuando el centro lo ha rellenado", () => {
    assert.equal(rotuloCentro(RUIZ, "Academia Ruiz Huesca"), "Academia Ruiz");
  });

  test("REGRESIÓN: sin comercial, el rótulo sigue siendo el del tenant", () => {
    // Hoy la hoja para familias de Lyceo pone "Lyceo", no "Lyceo academia".
    // Si esto cambiara, cambiaría un papel que ya se está imprimiendo.
    const config = { nombre_emisor: "Lyceo academia" };
    assert.equal(rotuloCentro(config, "Lyceo"), "Lyceo");
    assert.equal(nombreComercial(config, "Lyceo"), "Lyceo academia", "y el email sigue firmando distinto, a propósito");
  });

  test("el rótulo se cae al fiscal antes que dejar la hoja sin título", () => {
    assert.equal(rotuloCentro({ nombre_emisor: "Lyceo academia" }, ""), "Lyceo academia");
  });

  test("las tres funciones coinciden en cuanto hay nombre comercial", () => {
    // Es lo que hace que la rareza del respaldo deje de importar: el día que
    // un centro rellena el campo, el rótulo y el remitente dicen lo mismo.
    assert.equal(rotuloCentro(RUIZ, "X"), nombreComercial(RUIZ, "X"));
    assert.notEqual(nombreFiscal(RUIZ, "X"), nombreComercial(RUIZ, "X"), "el fiscal sigue siendo el suyo");
  });

  test("los espacios de los extremos se recortan", () => {
    assert.equal(nombreComercial({ nombre_comercial: "  Academia Ruiz  " }), "Academia Ruiz");
    assert.equal(nombreFiscal({ nombre_emisor: "  ACADEMIA RUIZ, S.L. " }), "ACADEMIA RUIZ, S.L.");
  });
}
