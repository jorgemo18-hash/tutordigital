// El PDF de la hoja para familias: cuatro cuartillas iguales en un A4.
//
// Lo que de verdad hay que comprobar aquí es que salen CUATRO, porque es lo
// único que hace que este documento sirva para lo que se pidió: imprimir un
// folio y sacar cuatro hojas para dar a los padres. Como el PDF se genera
// sin comprimir (ver generarHojaFamilias.js), su texto se puede leer
// decodificando los literales hexadecimales del contenido.
export async function run({ test, assert }) {
  const { buildHojaFamiliasPdfBuffer } =
    await import("../../server/lib/academiaHojaFamilias/generarHojaFamilias.js");
  const { construirPayloadHojaFamilias } =
    await import("../../server/lib/academiaHojaFamilias/payloadHojaFamilias.js");

  // El texto que lleva dentro el PDF. pdfkit parte las palabras en trozos
  // por el kerning ("<4c> 30 <7963656f>" es "Lyceo"), así que se juntan
  // todos los literales antes de buscar.
  function textoDelPdf(buffer) {
    const crudo = buffer.toString("latin1");
    return (crudo.match(/<([0-9a-fA-F]+)>/g) || [])
      .map((hex) => Buffer.from(hex.slice(1, -1), "hex").toString("latin1"))
      .join("");
  }

  const LYCEO = {
    franja_inicio: "15:30:00", franja_fin: "20:30:00", franja_duracion: 60,
    dias_laborables: [1, 2, 3, 4, 5],
    telefono_emisor: "675324128", email_emisor: "info@lyceoacademia.es",
    precios_publicos: {
      columnas: [{ id: "c1", titulo: "Primaria" }, { id: "c2", titulo: "Bachillerato" }],
      filas: [{ id: "f1", titulo: "1 día / semana" }, { id: "f2", titulo: "2 días / semana" }],
      precios: { "f1|c1": "40", "f1|c2": "50", "f2|c1": "60", "f2|c2": "70" },
      nota: "Matrícula gratuita",
    },
  };
  const datos = construirPayloadHojaFamilias({ tenantNombre: "Lyceo", config: LYCEO });

  test("es un PDF de una sola página", async () => {
    const buffer = await buildHojaFamiliasPdfBuffer(datos);
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    assert.equal((buffer.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length, 1);
  });

  test("EL PUNTO DE TODO: el folio lleva CUATRO cuartillas, no una", async () => {
    const texto = textoDelPdf(await buildHojaFamiliasPdfBuffer(datos));
    assert.equal((texto.match(/Lyceo/g) || []).length, 4, "el nombre del centro, una vez por cuartilla");
    assert.equal((texto.match(/HORARIO/g) || []).length, 4);
    assert.equal((texto.match(/PRECIOS/g) || []).length, 4);
  });

  test("la cuartilla lleva el horario, la tabla y el contacto", async () => {
    const texto = textoDelPdf(await buildHojaFamiliasPdfBuffer(datos));
    assert.ok(texto.includes("Lunes a viernes"));
    assert.ok(texto.includes("15:30"), "las horas de clase");
    assert.ok(texto.includes("1 día / semana"), "los conceptos de la tabla");
    assert.ok(texto.includes("Bachillerato"), "el encabezado encoge hasta caber, no se recorta");
    assert.ok(texto.includes("Matrícula gratuita"), "la nota al pie");
    assert.ok(texto.includes("675324128"), "el teléfono");
  });

  test("sin precios configurados sale igual, solo con el horario", async () => {
    const soloHorario = construirPayloadHojaFamilias({ tenantNombre: "Lyceo", config: { ...LYCEO, precios_publicos: null } });
    const texto = textoDelPdf(await buildHojaFamiliasPdfBuffer(soloHorario));
    assert.equal((texto.match(/HORARIO/g) || []).length, 4);
    assert.equal((texto.match(/PRECIOS/g) || []).length, 0, "no se imprime un cuadro vacío");
  });

  test("una hoja sin nada configurado no revienta", async () => {
    const buffer = await buildHojaFamiliasPdfBuffer(construirPayloadHojaFamilias({}));
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  });

  test("REGRESIÓN: la tabla más grande que admite el editor no se sale de la cuartilla", async () => {
    // 12x12 es el tope de preciosPublicos.js y no cabe en un cuarto de
    // folio ni encogiendo. Debe cortarse por abajo y seguir dejando sitio
    // al pie: una tabla pisando el teléfono es un papel inservible.
    const gigante = {
      columnas: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, titulo: `Columna ${i}` })),
      filas: Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, titulo: `Fila larguísima ${i}` })),
      precios: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}|c0`, "999 €"])),
      nota: "x".repeat(200),
    };
    const buffer = await buildHojaFamiliasPdfBuffer(
      construirPayloadHojaFamilias({ tenantNombre: "Centro", config: { ...LYCEO, precios_publicos: gigante } })
    );
    const texto = textoDelPdf(buffer);
    assert.equal((texto.match(/Centro/g) || []).length, 4, "las cuatro cuartillas siguen ahí");
    assert.equal((texto.match(/675324128/g) || []).length, 4, "y el pie con el teléfono también");
  });
}
