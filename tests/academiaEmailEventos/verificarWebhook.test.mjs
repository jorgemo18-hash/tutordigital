import crypto from "node:crypto";

// LA FIRMA ES LO ÚNICO QUE PROTEGE EL WEBHOOK.
//
// El endpoint de webhooks no puede llevar sesión: lo llama Resend, no un
// navegador. Su URL es pública. Si la verificación de firma se rompe (o se
// salta), cualquiera que adivine la URL puede mandar
// `{"type":"email.bounced","data":{"email_id":"..."}}` y marcar como
// rebotados los recibos que quiera.
//
// Y HAY UNA TRAMPA CONCRETA que estos tests existen para fijar. El SDK de
// Resend declara `verify({ headers })` con el tipo `Headers`, lo que invita
// a pasarle las cabeceras de la petición. Su implementación real lee
// `headers.id`, `headers.timestamp` y `headers.signature` — NO las
// cabeceras `svix-*`. Pasarle las cabeceras tal cual no da ningún error:
// las tres llegan undefined y la verificación falla siempre. Mismo patrón
// que el `reply_to` que no llegaba a Resend: una clave que nadie lee y de
// la que nadie protesta.
//
// Por eso estos tests NO usan un doble de la verificación: firman de
// verdad, con el mismo algoritmo que Resend (HMAC-SHA256 sobre
// `id.timestamp.cuerpo`, secreto en base64 tras `whsec_`), y dejan que
// corra el SDK entero. Es lo único que demuestra que el mapeo es correcto.
export async function run({ test, assert }) {
  const { verificarWebhookResend, cabecerasDeFirma } = await import(
    "../../server/lib/academiaEmailEventos/verificarWebhook.js"
  );

  const SECRETO_BYTES = crypto.randomBytes(24);
  const SECRETO = `whsec_${SECRETO_BYTES.toString("base64")}`;

  const EVENTO = {
    type: "email.bounced",
    created_at: "2026-09-17T16:00:00.000Z",
    data: {
      email_id: "ae2014de-c168-4c61-8267-70d2662a1ce1",
      from: "Lyceo academia <noreply@tutordigital.app>",
      to: ["familia@example.com"],
      subject: "Lyceo · Septiembre 2026",
      bounce: { type: "Permanent", subType: "General", message: "Recipient address does not exist" },
    },
  };

  // Firma como firma Resend (vía Svix).
  function firmar(cuerpo, { id = "msg_2abc", ts = Math.floor(Date.now() / 1000) } = {}) {
    const firma = crypto
      .createHmac("sha256", SECRETO_BYTES)
      .update(`${id}.${ts}.${cuerpo}`)
      .digest("base64");
    return {
      "svix-id": id,
      "svix-timestamp": String(ts),
      "svix-signature": `v1,${firma}`,
    };
  }

  const cuerpo = JSON.stringify(EVENTO);

  test("EL PUNTO DE TODO: una firma buena se acepta y devuelve el evento", () => {
    const r = verificarWebhookResend({ cuerpoCrudo: cuerpo, headers: firmar(cuerpo), secreto: SECRETO });
    assert.equal(r.ok, true, `motivo: ${r.motivo} ${r.detalle || ""}`);
    assert.equal(r.evento.type, "email.bounced");
    assert.equal(r.evento.data.bounce.message, "Recipient address does not exist");
    assert.equal(r.svixId, "msg_2abc", "el svix-id se devuelve: es lo que da idempotencia");
  });

  test("EL PUNTO DE TODO: un cuerpo manipulado se rechaza", () => {
    // Firmamos el cuerpo original y mandamos otro: es exactamente lo que
    // haría alguien que interceptase un webhook real.
    const headers = firmar(cuerpo);
    const falso = cuerpo.replace("email.bounced", "email.delivered");
    const r = verificarWebhookResend({ cuerpoCrudo: falso, headers, secreto: SECRETO });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "firma_no_valida");
  });

  test("un secreto distinto se rechaza", () => {
    const otro = `whsec_${crypto.randomBytes(24).toString("base64")}`;
    const r = verificarWebhookResend({ cuerpoCrudo: cuerpo, headers: firmar(cuerpo), secreto: otro });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "firma_no_valida");
  });

  test("sin secreto configurado NO se acepta nada (fail closed)", () => {
    // Si un despliegue se olvida de RESEND_WEBHOOK_SECRET, lo correcto es
    // que no entre ningún evento — no que entren todos sin comprobar.
    const r = verificarWebhookResend({ cuerpoCrudo: cuerpo, headers: firmar(cuerpo), secreto: "" });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "webhook_secret_no_configurado");
  });

  test("sin cabeceras de firma se rechaza antes de mirar el cuerpo", () => {
    const r = verificarWebhookResend({ cuerpoCrudo: cuerpo, headers: {}, secreto: SECRETO });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "faltan_cabeceras_de_firma");
  });

  test("un cuerpo vacío se rechaza", () => {
    assert.equal(verificarWebhookResend({ cuerpoCrudo: "", headers: firmar(""), secreto: SECRETO }).motivo, "cuerpo_vacio");
  });

  // Re-serializar el cuerpo cambia espacios y orden de claves y la firma ya
  // no cuadra. Es la razón de que la ruta tenga su propio lector de cuerpo
  // crudo, y este test lo demuestra en vez de dejarlo en un comentario.
  test("REGRESIÓN: si se parsea y se vuelve a serializar, la firma ya no vale", () => {
    const headers = firmar(cuerpo);
    const reserializado = JSON.stringify(JSON.parse(cuerpo), null, 2);
    assert.notEqual(reserializado, cuerpo, "el test no prueba nada si sale idéntico");
    const r = verificarWebhookResend({ cuerpoCrudo: reserializado, headers, secreto: SECRETO });
    assert.equal(r.ok, false, "por esto la ruta necesita el cuerpo tal como llegó");
  });

  test("las cabeceras se leen también con el prefijo estándar webhook-*", () => {
    // Algunos proxies reescriben svix-* a webhook-* (Standard Webhooks).
    const h = firmar(cuerpo);
    const r = verificarWebhookResend({
      cuerpoCrudo: cuerpo,
      headers: {
        "webhook-id": h["svix-id"],
        "webhook-timestamp": h["svix-timestamp"],
        "webhook-signature": h["svix-signature"],
      },
      secreto: SECRETO,
    });
    assert.equal(r.ok, true, `motivo: ${r.motivo}`);
  });

  test("cabecerasDeFirma: mapea a las claves que espera el SDK, no a svix-*", () => {
    // Si alguien "simplifica" esto devolviendo las cabeceras tal cual, el
    // SDK recibe undefined en los tres campos y NADA se verifica nunca.
    const c = cabecerasDeFirma({ "svix-id": "a", "svix-timestamp": "1", "svix-signature": "v1,x" });
    assert.deepEqual(c, { id: "a", timestamp: "1", signature: "v1,x" });
  });

  test("una cabecera repetida (array) no revienta: se coge la primera", () => {
    const c = cabecerasDeFirma({ "svix-id": ["a", "b"], "svix-timestamp": "1", "svix-signature": "v1,x" });
    assert.equal(c.id, "a");
  });
}
