// El email a la familia lo firma la academia, no TutorDigital.
//
// Antes todo salía como "TutorDigital <noreply@tutordigital.app>" y sin
// reply_to: la familia recibía su recibo de una marca que no conoce y, si
// respondía, el mensaje se perdía. La dirección no puede cambiar (Resend
// solo envía desde dominio verificado), así que lo que cambia es el nombre
// visible y la dirección de respuesta.
export async function run({ test, assert }) {
  const { buildRemitente, limpiarNombreRemitente, limpiarEmailRespuesta, REMITENTE_EMAIL } =
    await import("../../server/lib/academiaEnvio/remitente.js");

  test("firma con el nombre del centro y responde a su email", () => {
    const r = buildRemitente({ nombre_emisor: "Lyceo", email_emisor: "info@lyceo.es" }, "Academia Lyceo");
    assert.equal(r.from, `"Lyceo" <${REMITENTE_EMAIL}>`);
    assert.equal(r.replyTo, "info@lyceo.es");
  });

  // LA BANDEJA DE ENTRADA LLEVA EL NOMBRE COMERCIAL (migración 121).
  //
  // La razón social existe para los recibos y las facturas. En la bandeja
  // de una madre, "ACADEMIA RUIZ, S.L." no se reconoce: parece una gestoría
  // o un cobro raro, y un email que no se reconoce no se abre.
  test("EL PUNTO DE TODO: firma con el nombre comercial, no con la razón social", () => {
    const r = buildRemitente(
      { nombre_emisor: "ACADEMIA RUIZ, S.L.", nombre_comercial: "Academia Ruiz", email_emisor: "info@ruiz.es" },
      "Academia Ruiz Huesca"
    );
    assert.equal(r.from, `"Academia Ruiz" <${REMITENTE_EMAIL}>`);
    assert.ok(!r.from.includes("S.L."), "la razón social no se asoma a la bandeja de entrada");
  });

  // Este es el test que impide que la migración rompa a los centros que ya
  // estaban: con la columna nueva a NULL, la firma tiene que ser idéntica.
  test("REGRESIÓN: sin nombre comercial se firma igual que antes de la 121", () => {
    const r = buildRemitente({ nombre_emisor: "Lyceo academia", email_emisor: "info@lyceoacademia.es" }, "Lyceo");
    assert.equal(r.from, `"Lyceo academia" <${REMITENTE_EMAIL}>`);
    assert.equal(r.replyTo, "info@lyceoacademia.es");
  });

  test("borrar el nombre comercial en Ajustes devuelve la firma al fiscal", () => {
    // El panel manda "" cuando se vacía el campo, no null.
    const r = buildRemitente({ nombre_emisor: "Lyceo academia", nombre_comercial: "" }, "Lyceo");
    assert.equal(r.from, `"Lyceo academia" <${REMITENTE_EMAIL}>`);
  });

  test("REGRESIÓN: un salto de línea en el nombre COMERCIAL tampoco inyecta cabeceras", () => {
    // El saneado está en limpiarNombreRemitente y se aplica después de
    // elegir el nombre, así que el campo nuevo entra por el mismo filtro.
    // Sin esto, la columna nueva sería un agujero recién abierto.
    const r = buildRemitente({ nombre_comercial: "Ruiz\r\nBcc: espia@mal.com" }, "");
    assert.ok(!r.from.includes("\n") && !r.from.includes("\r"), "sin saltos de línea");
  });

  test("sin nombre_emisor cae en el nombre del centro, no en TutorDigital", () => {
    const r = buildRemitente({ email_emisor: "info@lyceo.es" }, "Academia Lyceo");
    assert.equal(r.from, `"Academia Lyceo" <${REMITENTE_EMAIL}>`);
  });

  test("sin nada configurado sigue saliendo igual que antes", () => {
    const r = buildRemitente({}, "");
    assert.equal(r.from, `"TutorDigital" <${REMITENTE_EMAIL}>`);
    assert.equal(r.replyTo, null, "sin reply_to, no uno inventado");
  });

  test("la dirección de envío NUNCA es la del centro (Resend la rechazaría)", () => {
    const r = buildRemitente({ nombre_emisor: "Lyceo", email_emisor: "jorge@gmail.com" }, "");
    assert.ok(r.from.includes(REMITENTE_EMAIL), "el from sigue siendo el dominio verificado");
    assert.ok(!r.from.includes("gmail.com"), "el email del centro solo vale para responder");
  });

  test("REGRESIÓN: un salto de línea en el nombre no inyecta cabeceras", () => {
    // El campo lo escribe el admin a mano y viaja sin escapar hasta la API
    // de Resend: un \n permitiría colar un Bcc en la cabecera.
    const r = buildRemitente({ nombre_emisor: "Lyceo\r\nBcc: espia@mal.com" }, "");
    assert.ok(!r.from.includes("\n") && !r.from.includes("\r"), "sin saltos de línea");
    assert.equal(r.from, `"Lyceo Bcc: espia@mal.com" <${REMITENTE_EMAIL}>`, "queda como texto inofensivo dentro del nombre");
  });

  test("REGRESIÓN: una coma en el nombre no parte la cabecera en dos destinos", () => {
    // Sin las comillas, "Academia Ruiz, S.L. <noreply@…>" se lee como dos
    // direcciones y el envío falla o va a donde no debe.
    const r = buildRemitente({ nombre_emisor: "Academia Ruiz, S.L." }, "");
    assert.equal(r.from, `"Academia Ruiz, S.L." <${REMITENTE_EMAIL}>`);
  });

  test("las comillas del propio nombre se quitan, no rompen el entrecomillado", () => {
    assert.equal(limpiarNombreRemitente('Academia "El Faro"'), "Academia El Faro");
    assert.equal(limpiarNombreRemitente("Barra \\ invertida"), "Barra invertida");
  });

  test("un nombre vacío o solo espacios no deja el from mudo", () => {
    assert.equal(limpiarNombreRemitente("   "), "TutorDigital");
    assert.equal(limpiarNombreRemitente(null), "TutorDigital");
  });

  test("un nombre kilométrico se recorta en vez de romper la cabecera", () => {
    assert.equal(limpiarNombreRemitente("A".repeat(200)).length, 78);
  });

  test("REGRESIÓN: un email mal escrito se descarta, no tumba el envío", () => {
    // Un campo mal rellenado en Ajustes haría que Resend rechazara la
    // petición entera y no saliera ni un recibo del mes.
    for (const malo of ["no-es-un-email", "a@b", "a@b.es, otro@c.es", "a b@c.es", "", null, "a@b.es\nBcc: x@y.es"]) {
      assert.equal(limpiarEmailRespuesta(malo), null, `debería descartarse: ${JSON.stringify(malo)}`);
    }
  });

  test("un email correcto con espacios alrededor se acepta limpio", () => {
    assert.equal(limpiarEmailRespuesta("  info@lyceo.es  "), "info@lyceo.es");
  });
}
