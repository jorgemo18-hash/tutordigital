// POR QUÉ NO LLEGÓ, EN CASTELLANO.
//
// Jorge, 23/09/2026, con la captura de una familia delante: *"¿qué significa
// esto? ¿podríamos hacer que esos mensajes salgan en castellano?"*.
//
// Lo que se vigila no es la traducción palabra por palabra sino la
// distinción que decide qué hacer: CORREGIR EL EMAIL o VOLVER A ENVIAR. Son
// acciones opuestas, y hacer la equivocada no sirve — cambiar el email de una
// familia porque tenía el buzón lleno estropea un dato que estaba bien.
export async function run({ test, assert }) {
  const { explicarMotivoEntrega } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/motivoEntrega.js"
  );

  // El caso literal de la captura, tal como lo guarda motivoDeEvento().
  const BUZON_LLENO = "The recipient's email provider sent a bounce message because the recipient's "
    + "inbox was full. You might be able to send to the same recipient in the future when the "
    + "mailbox is no longer full. · Transient · MailboxFull";

  test("EL CASO DE LA CAPTURA: buzón lleno, y que es temporal", () => {
    const m = explicarMotivoEntrega(BUZON_LLENO);
    assert.ok(m, "no se ha reconocido");
    assert.ok(m.corto.includes("buzón lleno"), m.corto);
    assert.ok(m.corto.includes("temporal"), `en la fila tiene que verse que es temporal: ${m.corto}`);
  });

  test("BUZÓN LLENO DICE REENVIAR, NO CORREGIR EL EMAIL", () => {
    // Es la frase que más importa de todo el archivo. El panel pinta este
    // rebote en rojo con triángulo, igual que una dirección inexistente, y
    // sin esto Jorge cambiaría un email que está bien.
    const m = explicarMotivoEntrega(BUZON_LLENO);
    assert.ok(/vuelve a enviarlo/i.test(m.explicacion), m.explicacion);
    assert.ok(/no es un problema de la dirección/i.test(m.explicacion), m.explicacion);
    assert.ok(!/corregir/i.test(m.explicacion), `manda corregir algo que está bien: ${m.explicacion}`);
  });

  test("UNA DIRECCIÓN QUE NO EXISTE DICE CORREGIR, NO REENVIAR", () => {
    const m = explicarMotivoEntrega("Recipient address does not exist · Permanent · General");
    assert.ok(/corregir el email/i.test(m.explicacion), m.explicacion);
    assert.ok(/no servirá/i.test(m.explicacion), `tiene que decir que reenviar no sirve: ${m.explicacion}`);
  });

  test("todo rebote temporal dice reenviar y todo permanente dice corregir", () => {
    for (const sub of ["General", "MailboxFull", "MessageTooLarge", "ContentRejected", "AttachmentRejected"]) {
      const m = explicarMotivoEntrega(`x · Transient · ${sub}`);
      assert.ok(m, `Transient · ${sub} sin traducir`);
      assert.ok(/la dirección está bien|no es un problema de la dirección/i.test(m.explicacion), `${sub}: ${m.explicacion}`);
    }
    for (const sub of ["General", "NoEmail"]) {
      const m = explicarMotivoEntrega(`x · Permanent · ${sub}`);
      assert.ok(/corregir/i.test(m.explicacion), `Permanent · ${sub}: ${m.explicacion}`);
    }
  });

  test("NADA DE INGLÉS en lo que se enseña", () => {
    for (const motivo of [BUZON_LLENO, "x · Permanent · General", "x · Undetermined · Undetermined"]) {
      const m = explicarMotivoEntrega(motivo);
      assert.ok(!/recipient|bounce|mailbox|inbox|provider/i.test(`${m.corto} ${m.explicacion}`), m.explicacion);
    }
  });

  test("lo técnico se conserva, corto, para el soporte del proveedor", () => {
    assert.equal(explicarMotivoEntrega(BUZON_LLENO).tecnico, "Transient · MailboxFull");
    assert.equal(explicarMotivoEntrega("x · Permanent · General").tecnico, "Permanent · General");
  });

  test("un evento de supresión, que solo trae 'mensaje · tipo', también se entiende", () => {
    const m = explicarMotivoEntrega("Email address is on the suppression list · Permanent");
    assert.ok(m, "no se ha reconocido");
    assert.ok(/corregir/i.test(m.explicacion));
  });

  test("lo que no se reconoce devuelve null, y la pantalla enseña el original", () => {
    // Un `email.failed` es una frase suelta, sin tipo ni subtipo. Mejor
    // leerla en inglés que inventarle una traducción.
    assert.equal(explicarMotivoEntrega("Domain not verified"), null);
    assert.equal(explicarMotivoEntrega(""), null);
    assert.equal(explicarMotivoEntrega(null), null);
  });

  test("el texto corto cabe en la fila", () => {
    // La fila corta a 42 caracteres ("No llegó · " incluido): si el corto no
    // cabe, se pierde justo el "(temporal)", que es lo que dice qué hacer.
    for (const motivo of [BUZON_LLENO, "x · Permanent · General", "x · Transient · MessageTooLarge",
      "x · Transient · AttachmentRejected", "x · Permanent · Suppressed"]) {
      const { corto } = explicarMotivoEntrega(motivo);
      assert.ok(`No llegó · ${corto}`.length <= 42, `"${corto}" no cabe`);
    }
  });
}
