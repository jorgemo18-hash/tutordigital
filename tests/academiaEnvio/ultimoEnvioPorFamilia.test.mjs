// EL ÚLTIMO EMAIL DE CADA FAMILIA, Y SI LLEGÓ.
//
// La decisión que estos tests fijan: se mira **el último envío**, no el del
// mes que esté seleccionado en pantalla. Un rebote no es un hecho mensual —
// es una propiedad de la dirección de esa familia. Si el email de los Ruiz
// no existe, no llegó el de septiembre y no llegará el de octubre.
//
// Y su consecuencia, que es la que hace que el aviso no se quede pegado
// para siempre: si después del rebote se mandó otro email y ESE llegó, el
// aviso desaparece solo.
export async function run({ test, assert }) {
  const { fetchUltimoEnvioPorFamilia } = await import(
    "../../server/lib/academiaEnvio/consultasEnvios.js"
  );

  // Doble de Supabase que devuelve las filas ya ordenadas por enviado_at
  // descendente, como hace la consulta real, y apunta cómo se le llamó.
  function adminFalso(filas, { error = null } = {}) {
    const llamada = {};
    const orden = [...filas].sort((a, b) => String(b.enviado_at).localeCompare(String(a.enviado_at)));
    const q = {
      select: (cols) => { llamada.cols = cols; return q; },
      eq: (c, v) => { llamada[c] = v; return q; },
      in: (c, v) => { llamada[c] = v; return q; },
      gte: (c, v) => { llamada.gte = { c, v }; return q; },
      order: (c, o) => { llamada.order = { c, ...o }; return Promise.resolve({ data: error ? null : orden, error }); },
    };
    return { llamada, from: (t) => { llamada.tabla = t; return q; } };
  }

  const AHORA = new Date().toISOString();
  const AYER = new Date(Date.now() - 86400000).toISOString();
  const ANTEAYER = new Date(Date.now() - 2 * 86400000).toISOString();

  test("EL PUNTO DE TODO: se queda con el último envío de cada familia", async () => {
    const admin = adminFalso([
      { familia_id: "f1", estado: "rebotado", motivo: "no existe", enviado_at: ANTEAYER },
      { familia_id: "f1", estado: "entregado", motivo: null, enviado_at: AHORA },
      { familia_id: "f2", estado: "entregado", motivo: null, enviado_at: ANTEAYER },
    ]);
    const { porFamilia, error } = await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1", "f2"]);
    assert.equal(error, null);
    assert.equal(porFamilia.f1.estado, "entregado", "el rebote viejo ya no manda: después llegó uno bien");
    assert.equal(porFamilia.f2.estado, "entregado");
  });

  test("y al revés: si el ÚLTIMO rebotó, manda el rebote aunque antes llegaran otros", async () => {
    const admin = adminFalso([
      { familia_id: "f1", estado: "entregado", motivo: null, enviado_at: ANTEAYER },
      { familia_id: "f1", estado: "entregado", motivo: null, enviado_at: AYER },
      { familia_id: "f1", estado: "rebotado", motivo: "buzón lleno", enviado_at: AHORA },
    ]);
    const { porFamilia } = await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1"]);
    assert.equal(porFamilia.f1.estado, "rebotado");
    assert.equal(porFamilia.f1.motivo, "buzón lleno");
  });

  test("una familia sin ningún envío no aparece: no es un problema, es que no se sabe", async () => {
    const admin = adminFalso([{ familia_id: "f1", estado: "entregado", enviado_at: AHORA }]);
    const { porFamilia } = await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1", "f2"]);
    assert.ok(!("f2" in porFamilia), "ausente, no con un estado inventado");
  });

  test("acota por tenant: los envíos de otro centro no se cuelan", async () => {
    const admin = adminFalso([]);
    await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1"]);
    assert.equal(admin.llamada.tabla, "academia_envios_email");
    assert.equal(admin.llamada.tenant_id, "t1", "sin esto, un centro vería los rebotes de otro");
    assert.deepEqual(admin.llamada.familia_id, ["f1"]);
  });

  test("acota por fecha y ordena del más reciente al más antiguo", async () => {
    // El orden NO es decorativo: de él depende que 'el primero de cada
    // familia' sea de verdad su último envío.
    const admin = adminFalso([]);
    await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1"]);
    assert.equal(admin.llamada.order.c, "enviado_at");
    assert.equal(admin.llamada.order.ascending, false, "si esto se invierte, se lee el envío MÁS VIEJO");
    assert.equal(admin.llamada.gte.c, "enviado_at");
  });

  test("sin familias no se consulta nada", async () => {
    const admin = adminFalso([]);
    const { porFamilia } = await fetchUltimoEnvioPorFamilia(admin, "t1", []);
    assert.deepEqual(porFamilia, {});
    assert.equal(admin.llamada.tabla, undefined, "ni una consulta con una lista vacía");
  });

  test("ids repetidos no multiplican la consulta", async () => {
    const admin = adminFalso([]);
    await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1", "f1", null, "f2"]);
    assert.deepEqual(admin.llamada.familia_id, ["f1", "f2"]);
  });

  test("un fallo se DEVUELVE, no se lanza: la pantalla tiene que poder enviar igual", async () => {
    // Esto es adorno del panel. Si un centro no pudiera mandar sus recibos
    // porque la consulta del estado de entrega se cayó, el remedio sería
    // peor que la enfermedad.
    const admin = adminFalso([], { error: { message: "boom" } });
    const { porFamilia, error } = await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1"]);
    assert.equal(error.message, "boom");
    assert.deepEqual(porFamilia, {});
  });

  test("una fila sin familia_id no rompe el mapa", async () => {
    const admin = adminFalso([
      { familia_id: null, estado: "rebotado", enviado_at: AHORA },
      { familia_id: "f1", estado: "entregado", enviado_at: AYER },
    ]);
    const { porFamilia } = await fetchUltimoEnvioPorFamilia(admin, "t1", ["f1"]);
    assert.equal(porFamilia.f1.estado, "entregado");
    assert.ok(!("null" in porFamilia));
  });
}
