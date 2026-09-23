// ABRIR EL PDF DE LA HOJA (sections/ejercicios/abrirPdf.js), con una ventana
// falsa.
export async function run({ test, assert }) {
  const { abrirPdf } = await import("../assets/shared/generador/abrirPdf.js");

  function ventana({ bloqueada = false } = {}) {
    const hechos = [];
    const pestana = { closed: false, document: { write: () => {} }, location: {}, close() { hechos.push("cerrada"); } };
    return {
      hechos, pestana,
      win: {
        open: () => { hechos.push("abierta"); return bloqueada ? null : pestana; },
        URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
        setTimeout: () => {},
      },
    };
  }

  test("LA PESTAÑA SE ABRE ANTES de pedir el PDF (si no, Safari la bloquea) y luego lo muestra", async () => {
    const { win, pestana, hechos } = ventana();
    await abrirPdf({ win, pedirPdfFn: async () => { hechos.push("pedido"); return "blob"; } });
    assert.deepEqual(hechos, ["abierta", "pedido"]);
    assert.equal(pestana.location.href, "blob:x");
  });

  test("si no se puede abrir pestaña, el PDF se descarga", async () => {
    const { win } = ventana({ bloqueada: true });
    const clics = [];
    const doc = { body: { appendChild: () => {} }, createElement: () => ({ click() { clics.push(this.download); }, remove() {} }) };
    await abrirPdf({ win, doc, pedirPdfFn: async () => "blob" });
    assert.deepEqual(clics, ["hoja-de-ejercicios.pdf"]);
  });

  test("si el PDF falla, la pestaña vacía se cierra y el error llega", async () => {
    const { win, hechos } = ventana();
    await assert.rejects(abrirPdf({ win, pedirPdfFn: async () => { throw new Error("no"); } }), /no/);
    assert.ok(hechos.includes("cerrada"));
  });
}
