// "ENVIADO EL 17 SEP" DE UN EMAIL QUE REBOTÓ ES LA MENTIRA QUE HAY QUE QUITAR.
//
// Todo el trabajo de los rebotes (migración 122) existe para que el panel
// deje de decir que un recibo se envió cuando la familia no lo tiene. Estos
// tests vigilan la última pieza: que ese dato, ya guardado en la base de
// datos, GANE en la pantalla.
//
// Las dos precedencias que se fijan aquí, y las dos son decisiones, no
// detalles:
//
//   - "No llegó" gana a "Enviado". Obvio.
//   - "No llegó" gana también a "Pendiente". Menos obvio: si la dirección no
//     existe, volver a pulsar Enviar rebotará igual. Lo que hay que hacer
//     primero es corregir el email, y para eso hay que verlo.
export async function run({ test, assert }) {
  const { calcularEstadoFamilia, claseDotEstado } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/estadoFamilia.js"
  );
  const { esProblemaDeEntrega, debeReemplazarEstado } = await import(
    "../../assets/shared/js/estadosEntrega.js"
  );

  const REBOTE = {
    estado: "rebotado",
    motivo: "Permanent · General · Recipient address does not exist",
    enviado_at: "2026-09-17T19:10:55.000Z",
  };

  // Una familia con su recibo YA enviado: sin el dato de entrega diría
  // "Enviado el 17 sep".
  function familiaConReciboEnviado(envioEmail = null) {
    return {
      familia_email: "familia@example.com",
      recibo: { id: "r1", estado: "enviado", fecha_envio: "2026-09-17T19:10:00.000Z" },
      alumnos_activos: [],
      envio_email: envioEmail,
    };
  }

  test("EL PUNTO DE TODO: un rebote gana a 'Enviado el 17 sep'", () => {
    const sinDato = calcularEstadoFamilia(familiaConReciboEnviado());
    assert.equal(sinDato.tipo, "enviado", "el test no prueba nada si sin el dato no decía 'enviado'");

    const estado = calcularEstadoFamilia(familiaConReciboEnviado(REBOTE));
    assert.equal(estado.tipo, "no_llego");
    assert.ok(!estado.texto.includes("Enviado"), `no puede seguir diciendo enviado: "${estado.texto}"`);
  });

  test("y gana también a 'Pendiente': reenviar a una dirección mala rebota igual", () => {
    const familia = {
      familia_email: "familia@example.com",
      // Recibo sin fecha_envio => pendiente.
      recibo: { id: "r1", estado: "borrador", fecha_envio: null },
      alumnos_activos: [],
      envio_email: REBOTE,
    };
    assert.equal(calcularEstadoFamilia(familia).tipo, "no_llego");
  });

  test("el texto lleva el motivo del proveedor, que es lo que dice qué hacer", () => {
    // "No llegó" no dice nada. "Recipient address does not exist" dice
    // exactamente qué arreglar.
    const estado = calcularEstadoFamilia(familiaConReciboEnviado(REBOTE));
    assert.ok(estado.texto.startsWith("No llegó"), estado.texto);
    assert.ok(estado.texto.includes("Recipient address"), estado.texto);
    assert.equal(estado.motivo, REBOTE.motivo, "el motivo completo viaja aparte, para el title de la fila");
  });

  test("un motivo kilométrico se recorta en la fila, pero no en el motivo", () => {
    const largo = { estado: "rebotado", motivo: "x".repeat(300) };
    const estado = calcularEstadoFamilia(familiaConReciboEnviado(largo));
    assert.ok(estado.texto.length < 70, `la fila no puede reventar: ${estado.texto.length} caracteres`);
    assert.ok(estado.texto.endsWith("…"));
    assert.equal(estado.motivo.length, 300, "el completo se conserva para el title");
  });

  test("sin motivo (un fallido sin explicación) el texto no queda colgando", () => {
    const estado = calcularEstadoFamilia(familiaConReciboEnviado({ estado: "fallido", motivo: null }));
    assert.equal(estado.texto, "No llegó");
  });

  // ── Lo que NO debe marcarse ──────────────────────────────────────────

  test("REGRESIÓN: 'entregado' no pinta ningún aviso — es el caso bueno", () => {
    const estado = calcularEstadoFamilia(familiaConReciboEnviado({ estado: "entregado", motivo: null }));
    assert.equal(estado.tipo, "enviado");
  });

  test("REGRESIÓN: 'enviado' (aceptado, sin noticias) TAMPOCO es un problema", () => {
    // Es el estado de un email recién salido, y también el de uno del que
    // nunca sabremos nada (si el webhook se cayera). No saber no es lo mismo
    // que haber fallado: marcarlo en rojo llenaría la pantalla de falsos
    // avisos cada vez que Resend tardara en avisar.
    const estado = calcularEstadoFamilia(familiaConReciboEnviado({ estado: "enviado", motivo: null }));
    assert.equal(estado.tipo, "enviado");
    assert.equal(esProblemaDeEntrega("enviado"), false);
    assert.equal(esProblemaDeEntrega("retrasado"), false, "un reintento en curso tampoco");
  });

  test("REGRESIÓN: sin envio_email (todo lo anterior a la migración 122) no se marca nada", () => {
    // Todos los recibos que Jorge mandó antes de esto tienen envio_email
    // null. Si eso se pintara como problema, el panel se llenaría de rojo
    // el día del despliegue.
    assert.equal(calcularEstadoFamilia(familiaConReciboEnviado(null)).tipo, "enviado");
    assert.equal(calcularEstadoFamilia(familiaConReciboEnviado(undefined)).tipo, "enviado");
  });

  test("un estado desconocido (una columna futura) no se pinta como problema", () => {
    assert.equal(esProblemaDeEntrega("loquesea"), false);
    assert.equal(calcularEstadoFamilia(familiaConReciboEnviado({ estado: "loquesea" })).tipo, "enviado");
  });

  // ── Precedencias por encima ──────────────────────────────────────────

  test("falta de email gana a todo: sin dirección no se puede ni intentar", () => {
    const familia = { ...familiaConReciboEnviado(REBOTE), familia_email: null };
    assert.equal(calcularEstadoFamilia(familia).tipo, "sin_email");
  });

  test("un fallo de envío de ESTA sesión gana al rebote de antes: es más reciente", () => {
    const estado = calcularEstadoFamilia(familiaConReciboEnviado(REBOTE), { tieneError: true });
    assert.equal(estado.tipo, "error");
  });

  test("los cuatro estados de problema se marcan, no solo el rebote", () => {
    for (const malo of ["rebotado", "queja", "fallido", "suprimido"]) {
      assert.equal(
        calcularEstadoFamilia(familiaConReciboEnviado({ estado: malo })).tipo,
        "no_llego",
        `"${malo}" tiene que marcarse: la familia no tiene el email`
      );
    }
  });

  test("el punto tiene su propia clase, distinta del rojo del error transitorio", () => {
    assert.equal(claseDotEstado("no_llego"), "ef-dot--no-llego");
    assert.notEqual(claseDotEstado("no_llego"), claseDotEstado("error"));
  });

  // El servidor y la pantalla usan EL MISMO módulo para esta frontera. Si
  // alguien vuelve a duplicarla, las dos copias se separan en silencio y el
  // panel deja de pintar lo que la base de datos considera un problema.
  test("la frontera de 'no llegó' es la misma que usa el backend al guardar", () => {
    // debeReemplazarEstado es la regla que aplica el webhook; si pinta y
    // guarda con criterios distintos, un rebote guardado no se vería.
    assert.equal(debeReemplazarEstado("entregado", "rebotado"), true);
    assert.equal(debeReemplazarEstado("rebotado", "entregado"), false);
    for (const malo of ["rebotado", "queja", "fallido", "suprimido"]) {
      assert.equal(esProblemaDeEntrega(malo), true, malo);
    }
  });
}
