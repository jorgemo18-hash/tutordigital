import crypto from "node:crypto";

// LA RUTA DEL WEBHOOK, DE PUNTA A PUNTA.
//
// Los otros dos ficheros prueban las piezas (firma y aplicación del
// evento). Este prueba el cableado, que es donde están los dos fallos que
// no darían ningún error visible:
//
//   - Que el cuerpo llegue CRUDO. Si el parser JSON de Fastify se come el
//     cuerpo y la ruta re-serializa, la firma no cuadra NUNCA y el webhook
//     deja de funcionar entero, en silencio, con Resend reintentando.
//   - Que una firma inválida devuelva 401 y no escriba nada. Esta ruta no
//     lleva sesión: es la única puerta de la API que no pide token.
//
// Y una tercera cosa que no es un fallo sino una decisión: con firma válida
// se contesta 2xx aunque falle la escritura, porque un 5xx hace que Resend
// reintente eternamente y acabe desactivando el webhook.
export async function run({ test, assert }) {
  const { createApp } = await import("../server/app.js");

  const SECRETO_BYTES = crypto.randomBytes(24);
  const SECRETO = `whsec_${SECRETO_BYTES.toString("base64")}`;

  const EVENTO = {
    type: "email.bounced",
    created_at: "2026-09-17T16:00:00.000Z",
    data: {
      email_id: "re_de_prueba",
      to: ["familia@example.com"],
      subject: "Lyceo · Septiembre 2026",
      bounce: { type: "Permanent", subType: "General", message: "Recipient address does not exist" },
    },
  };

  function firmar(cuerpo, id = "msg_ruta_1") {
    const ts = Math.floor(Date.now() / 1000);
    const firma = crypto.createHmac("sha256", SECRETO_BYTES).update(`${id}.${ts}.${cuerpo}`).digest("base64");
    return { "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${firma}`, "content-type": "application/json" };
  }

  // La ruta escribe con la service role, que aquí no existe. Se sustituye
  // el módulo no: se comprueba lo que SÍ se puede comprobar sin base de
  // datos — el código de respuesta y que la firma se valida de verdad.
  async function pedir({ cuerpo, headers, secreto = SECRETO }) {
    const antes = process.env.RESEND_WEBHOOK_SECRET;
    process.env.RESEND_WEBHOOK_SECRET = secreto;
    const app = await createApp();
    try {
      return await app.inject({ method: "POST", url: "/api/v1/webhooks/resend", payload: cuerpo, headers });
    } finally {
      await app.close();
      if (antes === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
      else process.env.RESEND_WEBHOOK_SECRET = antes;
    }
  }

  test("la ruta existe y NO pide sesión (es la única así de toda la API)", async () => {
    const res = await pedir({ cuerpo: "{}", headers: { "content-type": "application/json" } });
    assert.notEqual(res.statusCode, 404, "la ruta tiene que estar registrada");
    assert.equal(res.statusCode, 401, "sin firma, 401 — no 403 de tenant ni 400 de body");
  });

  test("EL PUNTO DE TODO: una firma inválida se rechaza con 401", async () => {
    const cuerpo = JSON.stringify(EVENTO);
    const res = await pedir({
      cuerpo,
      headers: { "svix-id": "msg_x", "svix-timestamp": "1", "svix-signature": "v1,firmainventada", "content-type": "application/json" },
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { ok: false });
  });

  // EL PUNTO DE TODO, y el cuerpo va INDENTADO a propósito.
  //
  // Un JSON compacto sobrevive a un `JSON.parse` + `JSON.stringify`: sale
  // idéntico, la firma sigue cuadrando y el test pasa aunque alguien haya
  // quitado el lector de cuerpo crudo. Es decir: con un cuerpo compacto
  // este test NO prueba nada (comprobado revirtiendo el parser: seguía
  // pasando). Con el cuerpo indentado, el viaje de ida y vuelta cambia el
  // texto, la firma deja de valer y el test falla — que es lo que tiene que
  // hacer. Resend no promete un JSON compacto.
  test("EL PUNTO DE TODO: el cuerpo llega tal cual, sin pasar por JSON.parse", async () => {
    const cuerpo = JSON.stringify(EVENTO, null, 2);
    assert.notEqual(JSON.stringify(JSON.parse(cuerpo)), cuerpo, "si sale igual, este test no prueba nada");
    const res = await pedir({ cuerpo, headers: firmar(cuerpo) });
    assert.notEqual(res.statusCode, 401, "401 aquí significa que alguien se ha comido el cuerpo crudo");
    assert.equal(res.statusCode, 200, `esperaba 200 (aunque la escritura falle), recibió ${res.statusCode}`);
  });

  test("y el caso normal, con el JSON compacto, también vale", async () => {
    const cuerpo = JSON.stringify(EVENTO);
    const res = await pedir({ cuerpo, headers: firmar(cuerpo, "msg_ruta_2") });
    assert.equal(res.statusCode, 200);
  });

  test("sin RESEND_WEBHOOK_SECRET no entra nada (fail closed)", async () => {
    const cuerpo = JSON.stringify(EVENTO);
    const res = await pedir({ cuerpo, headers: firmar(cuerpo, "msg_ruta_3"), secreto: "" });
    assert.equal(res.statusCode, 401, "un despliegue sin secreto no acepta eventos a ciegas");
  });

  test("el parser de cuerpo crudo NO se le contagia al resto de la API", async () => {
    // El parser está encapsulado en el plugin del webhook. Si se hubiera
    // registrado global, TODAS las rutas recibirían strings donde esperan
    // objetos y medio backend dejaría de funcionar. Se comprueba contra una
    // ruta cualquiera que valide un body: tiene que seguir dando su error
    // de siempre (auth/tenant), no un fallo de parseo.
    const app = await createApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/academia/config",
      payload: { franja_inicio: "3pm" },
      headers: { "content-type": "application/json" },
    });
    await app.close();
    assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/validación, recibió ${res.statusCode}`);
  });
}
