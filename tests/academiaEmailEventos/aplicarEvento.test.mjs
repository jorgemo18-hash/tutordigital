// QUÉ HACEMOS CON UN EVENTO DE RESEND YA VERIFICADO.
//
// Lo que se vigila aquí, por orden de importancia:
//
//   1. Que un 'delivered' que llega TARDE no borre un rebote. Los webhooks
//      no llegan en orden. Si un 'delivered' retrasado pisa el 'bounced',
//      el recibo desaparece de la lista de problemas de Jorge y la familia
//      sigue sin haber recibido nada. Es el fallo más caro de todos y el
//      más silencioso.
//   2. Que un reintento no duplique nada. Resend reenvía el mismo evento
//      hasta que contestamos 2xx.
//   3. Que un evento de un email que no tenemos registrado NO se tire.
export async function run({ test, assert }) {
  const { aplicarEventoResend, debeReemplazarEstado, estadoDeEvento, motivoDeEvento } = await import(
    "../../server/lib/academiaEmailEventos/aplicarEvento.js"
  );

  function evento(type, extra = {}) {
    return {
      type,
      created_at: "2026-09-17T16:00:00.000Z",
      data: { email_id: "re_1", to: ["familia@example.com"], subject: "Lyceo · Septiembre 2026", ...extra },
    };
  }

  const REBOTE = evento("email.bounced", {
    bounce: { type: "Permanent", subType: "General", message: "Recipient address does not exist" },
  });

  // Doble de Supabase: apunta lo que se escribe y permite simular fallos.
  function adminFalso({ envio = { id: "env_1", estado: "enviado" }, errorInsert = null, errorUpdate = null } = {}) {
    const escrito = { eventos: [], updates: [] };
    return {
      escrito,
      from(tabla) {
        if (tabla === "academia_email_eventos") {
          return {
            insert(fila) {
              if (!errorInsert) escrito.eventos.push(fila);
              return Promise.resolve({ error: errorInsert });
            },
          };
        }
        // academia_envios_email: o se consulta (select/eq/maybeSingle) o se
        // actualiza (update/eq).
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: envio, error: null }) }) }),
          update(campos) {
            return {
              eq: (_c, id) => {
                if (!errorUpdate) escrito.updates.push({ id, ...campos });
                return Promise.resolve({ error: errorUpdate });
              },
            };
          },
        };
      },
    };
  }

  // ── Lo que importa de verdad: el orden de llegada ────────────────────

  test("EL PUNTO DE TODO: un 'delivered' tardío NO borra un rebote ya registrado", () => {
    assert.equal(debeReemplazarEstado("rebotado", "entregado"), false);
    assert.equal(debeReemplazarEstado("rebotado", "retrasado"), false);
    assert.equal(debeReemplazarEstado("queja", "entregado"), false);
    assert.equal(debeReemplazarEstado("fallido", "entregado"), false);
  });

  test("pero un rebote SÍ pisa un 'entregado': un email se entrega y rebota después", () => {
    assert.equal(debeReemplazarEstado("entregado", "rebotado"), true);
    assert.equal(debeReemplazarEstado("enviado", "rebotado"), true);
  });

  test("entre dos problemas gana el más grave, no el más nuevo", () => {
    assert.equal(debeReemplazarEstado("rebotado", "queja"), false, "un rebote no se degrada a queja");
    assert.equal(debeReemplazarEstado("queja", "rebotado"), true);
  });

  test("el estado no retrocede de 'entregado' a 'enviado'", () => {
    // 'email.sent' no traduce a ningún estado a propósito: es lo que ya
    // sabíamos al aceptar el envío.
    assert.equal(estadoDeEvento("email.sent"), null);
    assert.equal(debeReemplazarEstado("entregado", "enviado"), false);
  });

  test("los eventos que no dicen nada sobre la entrega no tocan el estado", () => {
    assert.equal(estadoDeEvento("email.opened"), null);
    assert.equal(estadoDeEvento("email.clicked"), null);
    assert.equal(debeReemplazarEstado("enviado", null), false);
  });

  // ── El motivo, que es lo que Jorge va a leer ─────────────────────────

  test("el motivo lleva el texto del proveedor, no un 'rebotado' genérico", () => {
    // "Recipient address does not exist" dice qué hacer (corregir el email);
    // "rebotado" no dice nada.
    //
    // Y EL MENSAJE VA PRIMERO, no la clasificación de Resend. En la fila del
    // panel el motivo se recorta, y con el orden del proveedor
    // (type · subType · message) se leía "Permanent · General · Recipient
    // address d…": la jerga completa y cortado antes de lo útil.
    assert.equal(
      motivoDeEvento(REBOTE),
      "Recipient address does not exist · Permanent · General"
    );
    assert.ok(
      motivoDeEvento(REBOTE).startsWith("Recipient address"),
      "lo primero tiene que ser lo que se lee en la fila recortada"
    );
  });

  test("el motivo de un fallo y de una supresión también se recogen", () => {
    assert.equal(motivoDeEvento(evento("email.failed", { failed: { reason: "no hay dominio" } })), "no hay dominio");
    assert.equal(
      motivoDeEvento(evento("email.suppressed", { suppressed: { type: "bounce", message: "en lista" } })),
      "en lista · bounce"
    );
    assert.equal(motivoDeEvento(evento("email.delivered")), null);
  });

  // ── El camino completo ───────────────────────────────────────────────

  test("un rebote guarda el evento y marca el envío", async () => {
    const admin = adminFalso();
    const r = await aplicarEventoResend(admin, { evento: REBOTE, svixId: "msg_1" });
    assert.equal(r.ok, true);
    assert.equal(r.estado, "rebotado");
    assert.equal(admin.escrito.eventos.length, 1);
    assert.equal(admin.escrito.eventos[0].svix_id, "msg_1");
    assert.equal(admin.escrito.eventos[0].envio_id, "env_1", "el evento queda enlazado con su envío");
    assert.deepEqual(admin.escrito.eventos[0].payload, REBOTE, "se guarda el cuerpo entero");
    assert.equal(admin.escrito.updates.length, 1);
    assert.equal(admin.escrito.updates[0].estado, "rebotado");
    assert.ok(admin.escrito.updates[0].motivo.includes("does not exist"));
  });

  test("un 'delivered' tardío tras un rebote guarda el evento pero NO actualiza", async () => {
    const admin = adminFalso({ envio: { id: "env_1", estado: "rebotado" } });
    const r = await aplicarEventoResend(admin, { evento: evento("email.delivered"), svixId: "msg_2" });
    assert.equal(r.ok, true);
    assert.equal(r.estado, null);
    assert.equal(admin.escrito.eventos.length, 1, "el histórico sí lo guarda: la pista no se pierde");
    assert.equal(admin.escrito.updates.length, 0, "pero el rebote sigue en pie");
  });

  test("REINTENTO: el mismo evento dos veces no duplica ni revienta", async () => {
    // 23505 = clave duplicada (el unique de svix_id). Resend reenvía el
    // mismo evento hasta que contestamos 2xx, así que esto pasa de verdad.
    const admin = adminFalso({ errorInsert: { code: "23505", message: "duplicate key" } });
    const r = await aplicarEventoResend(admin, { evento: REBOTE, svixId: "msg_1" });
    assert.equal(r.ok, true, "un reintento no es un error");
    assert.equal(r.duplicado, true);
    assert.equal(admin.escrito.updates.length, 0, "y no se vuelve a tocar el envío");
  });

  test("un evento de un email que no tenemos registrado se guarda huérfano, no se tira", async () => {
    // Pasa con los emails enviados antes de la migración 122 y con los de
    // soporte. Un evento perdido no se recupera.
    const admin = adminFalso({ envio: null });
    const r = await aplicarEventoResend(admin, { evento: REBOTE, svixId: "msg_3" });
    assert.equal(r.ok, true);
    assert.equal(admin.escrito.eventos.length, 1);
    assert.equal(admin.escrito.eventos[0].envio_id, null);
    assert.equal(admin.escrito.eventos[0].resend_email_id, "re_1", "queda el id para emparejarlo después");
  });

  test("un evento sin email_id no se aplica (no hay nada con lo que casarlo)", async () => {
    const admin = adminFalso();
    const r = await aplicarEventoResend(admin, { evento: { type: "email.bounced", data: {} } });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "evento_sin_tipo_o_email_id");
    assert.equal(admin.escrito.eventos.length, 0);
  });

  test("si falla el UPDATE, el evento ya está guardado: se puede reconstruir", async () => {
    // Es la razón del orden (primero el evento, después el estado): lo que
    // no se puede perder es lo que nos contaron.
    const admin = adminFalso({ errorUpdate: { message: "boom" } });
    const r = await aplicarEventoResend(admin, { evento: REBOTE, svixId: "msg_4" });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, "no_se_pudo_actualizar_el_envio");
    assert.equal(admin.escrito.eventos.length, 1);
  });
}
