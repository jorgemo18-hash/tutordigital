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
