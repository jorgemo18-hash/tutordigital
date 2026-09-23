// UN CHROMIUM REUTILIZADO ENTRE PDFs (server/lib/hojaPdf/navegadorReutilizable.js).
export async function run({ test, assert }) {
  const { crearNavegadorReutilizable } = await import("../../server/lib/hojaPdf/navegadorReutilizable.js");

  function fabrica() {
    const lanzados = [];
    const lanzar = async () => {
      const nav = { connected: true, cerrado: false, close: async () => { nav.cerrado = true; nav.connected = false; } };
      lanzados.push(nav);
      return nav;
    };
    return { lanzados, lanzar };
  }

  test("dos PDFs seguidos usan el MISMO navegador (el arranque se paga una vez)", async () => {
    const f = fabrica();
    const n = crearNavegadorReutilizable({ lanzar: f.lanzar });
    const a = await n.obtener();
    const b = await n.obtener();
    assert.equal(a, b);
    assert.equal(f.lanzados.length, 1);
  });

  test("dos peticiones a la vez no arrancan dos navegadores", async () => {
    const f = fabrica();
    const n = crearNavegadorReutilizable({ lanzar: f.lanzar });
    const [a, b] = await Promise.all([n.obtener(), n.obtener()]);
    assert.equal(a, b);
    assert.equal(f.lanzados.length, 1);
  });

  test("si el navegador se ha caído, se arranca otro", async () => {
    const f = fabrica();
    const n = crearNavegadorReutilizable({ lanzar: f.lanzar });
    (await n.obtener()).connected = false;
    await n.obtener();
    assert.equal(f.lanzados.length, 2);
  });

  test("descartar lo cierra y el siguiente es nuevo; un arranque fallido no se queda pegado", async () => {
    const f = fabrica();
    const n = crearNavegadorReutilizable({ lanzar: f.lanzar });
    const a = await n.obtener();
    await n.descartar();
    assert.equal(a.cerrado, true);
    assert.notEqual(await n.obtener(), a);
    let primera = true;
    const m = crearNavegadorReutilizable({ lanzar: async () => { if (primera) { primera = false; throw new Error("no arranca"); } return { connected: true }; } });
    await assert.rejects(m.obtener());
    assert.equal((await m.obtener()).connected, true);
  });
}
