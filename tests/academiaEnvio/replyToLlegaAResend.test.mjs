// LA DIRECCIÓN DE RESPUESTA TIENE QUE LLEGAR A LA API DE RESEND.
//
// EL FALLO QUE MOTIVA ESTE TEST (encontrado el 17/09/2026, justo antes de que
// Jorge mandara sus primeras facturas de verdad). El código construía bien el
// remitente y se lo pasaba bien a `sendReciboEmail`, y `sendReciboEmail` se lo
// pasaba a Resend con la clave **`reply_to`**. El SDK de Resend 6.x espera
// **`replyTo`**: su `parseEmailToApiOptions` arma el cuerpo de la petición
// leyendo solo las claves que conoce (`reply_to: email.replyTo`) y descarta
// las que no. Resultado: la dirección de respuesta NO SE ENVIABA. Una familia
// respondía a su recibo y la respuesta se perdía en `noreply@`.
//
// Y POR QUÉ NO LO CAZÓ NINGÚN TEST, que es lo importante. Había dos tests
// sobre esto y los dos pasaban: uno comprueba que `buildRemitente` devuelve el
// `replyTo` correcto, y el otro que `enviarFamiliaEmail` llama a
// `sendReciboEmail` con ese `replyTo`. Los dos se paran justo antes de la
// frontera real — lo que se le entrega a la biblioteca de terceros — y una
// clave de más en un objeto no es un error para nadie: no hay excepción, no
// hay aviso, el email sale igual y solo falta lo que no se ve.
//
// Así que este test NO se para ahí: deja que corra el SDK de verdad e
// intercepta el `fetch`, que es lo único que demuestra qué se manda.
export async function run({ test, assert }) {
  const { sendReciboEmail } = await import("../../server/lib/email.js");

  // Captura lo que el SDK manda de verdad por HTTP.
  //
  // LA CLAVE DE API SE PONE AQUÍ DENTRO, no en el cuerpo de `run()`. El runner
  // de este repositorio REGISTRA todos los tests primero y los ejecuta
  // después, así que cualquier preparación escrita fuera de un `test()` ya se
  // ha deshecho cuando el test corre. Puesto fuera, el SDK se construía sin
  // clave, `sendReciboEmail` lanzaba antes de llegar al fetch y los tests
  // fallaban por un motivo que no tenía nada que ver con lo que prueban.
  // (No se llama a ninguna API: el fetch está interceptado.)
  async function interceptar(envio) {
    const fetchAntes = globalThis.fetch;
    const claveAntes = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_0000000000";
    const peticiones = [];
    globalThis.fetch = async (url, opciones = {}) => {
      peticiones.push({ url: String(url), body: JSON.parse(opciones.body || "{}") });
      return new Response(JSON.stringify({ id: "email_test" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    };
    try {
      await envio();
    } finally {
      globalThis.fetch = fetchAntes;
      if (claveAntes === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = claveAntes;
    }
    return peticiones;
  }

  const RECIBO = {
    to: "familia@example.com",
    subject: "Recibo de septiembre",
    html: "<p>Adjuntamos el recibo.</p>",
    from: '"Lyceo academia" <noreply@tutordigital.app>',
    replyTo: "info@lyceoacademia.es",
  };

  test("EL PUNTO DE TODO: el reply_to llega en el cuerpo de la petición", async () => {
    const [peticion] = await interceptar(() => sendReciboEmail(RECIBO));
    assert.ok(peticion, "tiene que haber una petición a la API");
    assert.ok(peticion.url.includes("/emails"), `va al endpoint de emails: ${peticion.url}`);
    assert.deepEqual(
      peticion.body.reply_to, "info@lyceoacademia.es",
      "si esto viene undefined, la familia responde y la respuesta se pierde"
    );
  });

  test("y el nombre del centro va en el from, que es lo que se ve en la bandeja", async () => {
    const [peticion] = await interceptar(() => sendReciboEmail(RECIBO));
    assert.equal(peticion.body.from, '"Lyceo academia" <noreply@tutordigital.app>');
    assert.equal(peticion.body.to, "familia@example.com");
    assert.equal(peticion.body.subject, "Recibo de septiembre");
  });

  // Sin dirección de respuesta configurada el email tiene que salir IGUAL:
  // un centro que no ha rellenado su email no puede quedarse sin recibos.
  test("sin replyTo el envío sigue saliendo, solo sin dirección de respuesta", async () => {
    const [peticion] = await interceptar(() =>
      sendReciboEmail({ ...RECIBO, replyTo: undefined })
    );
    assert.ok(peticion, "el email sale igual");
    assert.ok(!peticion.body.reply_to, "y sin reply_to, no con uno inventado");
  });

  // EL ID QUE DEVUELVE RESEND HAY QUE DEVOLVERLO HACIA ARRIBA.
  //
  // Es el mismo `id` que viaja en sus webhooks como `data.email_id`, y es lo
  // único que permite atribuir un rebote a un recibo concreto (migración
  // 122). Antes esta función leía solo el `error` de la respuesta y tiraba
  // el `data`. Si alguien "simplifica" esto otra vez, los rebotes dejan de
  // poderse emparejar y, como siempre, sin ningún error de por medio.
  test("devuelve el id del email, que es lo que casa con los webhooks", async () => {
    const antes = globalThis.fetch;
    const claveAntes = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_0000000000";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: "ae2014de-c168-4c61-8267-70d2662a1ce1" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    try {
      const r = await sendReciboEmail(RECIBO);
      assert.equal(r.id, "ae2014de-c168-4c61-8267-70d2662a1ce1");
    } finally {
      globalThis.fetch = antes;
      if (claveAntes === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = claveAntes;
    }
  });

  test("si Resend no devolviera id, el envío NO falla: solo se pierde el rastro", async () => {
    // El email ya salió. Quedarse sin registrar el envío es un problema
    // menor; lanzar aquí tumbaría la tanda de recibos que falte.
    const antes = globalThis.fetch;
    const claveAntes = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_0000000000";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    try {
      const r = await sendReciboEmail(RECIBO);
      assert.equal(r.id, null, "null, no undefined ni excepción");
    } finally {
      globalThis.fetch = antes;
      if (claveAntes === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = claveAntes;
    }
  });

  // El adjunto es el recibo en PDF: si se cayera, la familia recibiría un
  // correo que dice "adjuntamos el recibo" sin recibo.
  test("el PDF del recibo viaja como adjunto", async () => {
    const [peticion] = await interceptar(() =>
      sendReciboEmail({
        ...RECIBO,
        attachments: [{ filename: "recibo.pdf", content: Buffer.from("%PDF-1.4 falso") }],
      })
    );
    assert.equal(peticion.body.attachments?.length, 1);
    assert.equal(peticion.body.attachments[0].filename, "recibo.pdf");
  });
}
