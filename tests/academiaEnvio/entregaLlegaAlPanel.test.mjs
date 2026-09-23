// EL VIAJE COMPLETO DEL ESTADO DE ENTREGA: base de datos -> ruta -> pantalla.
//
// POR QUÉ ESTE TEST EXISTE. Al revertir a mano la línea de la ruta que
// manda `envio_email` al panel, **los quince tests de esta función seguían
// pasando**: unos prueban la consulta a la base de datos y otros el cálculo
// del estado en la pantalla, y ninguno cruzaba la frontera de en medio. Una
// clave que no se manda no es un error para nadie — no hay excepción, no hay
// aviso, el panel simplemente vuelve a decir "Enviado el 17 sep" de un email
// que rebotó, que es justo la mentira que todo esto venía a quitar.
//
// Es el mismo patrón que el `reply_to` del commit abdbf5dd, y por eso aquí
// no se prueba ninguna pieza por separado: se coge lo que arma la RUTA de
// verdad y se le da tal cual a la función que pinta la PANTALLA de verdad.
export async function run({ test, assert }) {
  const { buildListItem } = await import(
    "../../server/routes/v1/academia-recibos/listado.routes.js"
  );
  const { calcularEstadoFamilia } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/estadoFamilia.js"
  );

  const REBOTE = {
    estado: "rebotado",
    motivo: "Permanent · General · Recipient address does not exist",
    enviado_at: "2026-09-17T19:10:55.000Z",
  };

  // Una familia como la arma la ruta: recibo YA enviado, que sin el dato de
  // entrega se pintaría como "Enviado".
  function itemDeLaRuta(ultimoEnvio) {
    return buildListItem({
      familia: { id: "f1", nombre: "Familia Ruiz", email: "ruiz@example.com", metodo_pago: "bizum" },
      alumnosActivos: [{ id: "a1", nombre: "Eric", curso: "1º ESO" }],
      recibo: { id: "r1", estado: "enviado", total_neto: 85, fecha_envio: "2026-09-17T19:10:00.000Z" },
      conSesiones: new Set(),
      informesEnviados: {},
      ultimoEnvio,
    });
  }

  test("EL PUNTO DE TODO: el rebote sobrevive el viaje y la pantalla lo pinta", () => {
    const item = itemDeLaRuta(REBOTE);
    assert.ok(item.envio_email, "la ruta tiene que mandarlo");
    assert.equal(item.envio_email.estado, "rebotado");

    const estado = calcularEstadoFamilia(item);
    assert.equal(
      estado.tipo, "no_llego",
      "si esto dice 'enviado', el dato está en la base de datos y la pantalla no lo ve"
    );
    // Traducido desde el 23/09 (ver motivoEntrega.js): lo que se comprueba
    // es que el motivo llega a la fila, no en qué idioma.
    assert.ok(estado.texto.includes("la dirección no existe"), estado.texto);
  });

  test("y el caso bueno también viaja: una entrega no pinta ningún aviso", () => {
    const item = itemDeLaRuta({ estado: "entregado", motivo: null, enviado_at: REBOTE.enviado_at });
    assert.equal(item.envio_email.estado, "entregado");
    assert.equal(calcularEstadoFamilia(item).tipo, "enviado");
  });

  test("sin envío registrado la ruta manda null, y la pantalla no inventa un problema", () => {
    // Es el estado de TODO lo que Jorge envió antes de la migración 122. Si
    // esto se pintara en rojo, el panel se llenaría de avisos falsos el día
    // del despliegue.
    const item = itemDeLaRuta(null);
    assert.equal(item.envio_email, null, "null explícito, no undefined ni la clave ausente");
    assert.equal(calcularEstadoFamilia(item).tipo, "enviado");
  });

  test("la clave se llama EXACTAMENTE como la lee la pantalla", () => {
    // El nombre es el contrato. Renombrarlo en un lado y no en el otro no
    // rompe nada visible: solo deja de pintarse.
    const item = itemDeLaRuta(REBOTE);
    assert.ok("envio_email" in item, `claves que manda la ruta: ${Object.keys(item).join(", ")}`);
  });

  test("y el resto de lo que la ruta ya mandaba sigue ahí", () => {
    // El campo nuevo se añadió a una función que ya existía; esto es lo que
    // detecta que al tocarla se haya caído algo por el camino.
    const item = itemDeLaRuta(REBOTE);
    for (const clave of ["familia_id", "familia_nombre", "familia_email", "familia_metodo_pago", "recibo", "alumnos_activos", "tiene_hermanos"]) {
      assert.ok(clave in item, `falta ${clave}`);
    }
    assert.equal(item.familia_email, "ruiz@example.com");
    assert.equal(item.recibo.fecha_envio, "2026-09-17T19:10:00.000Z");
  });
}
