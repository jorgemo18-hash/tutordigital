// siguienteNumeroRecibo() — no hace cálculos de dinero, pero es parte del
// contrato público de calculos.js. Stub local mínimo (no el fake compartido
// de tests/support/, que no modela count:"exact"/head:true) porque solo lo
// usa esta función en todo el repo.

function makeFakeAdminConCount({ count = 0, error = null } = {}) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return Promise.resolve({ count, error });
            },
          };
        },
      };
    },
  };
}

export async function run({ test, assert }) {
  const { siguienteNumeroRecibo } = await import("../../server/lib/academiaRecibos/calculos.js");

  test("sin recibos previos (count 0) -> primer número del año", async () => {
    const admin = makeFakeAdminConCount({ count: 0 });
    const r = await siguienteNumeroRecibo(admin, "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-001");
  });

  test("con recibos previos -> siguiente consecutivo", async () => {
    const admin = makeFakeAdminConCount({ count: 5 });
    const r = await siguienteNumeroRecibo(admin, "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-006");
  });

  test("contador de 3+ dígitos no se trunca (padStart es un mínimo, no un máximo)", async () => {
    const admin = makeFakeAdminConCount({ count: 999 });
    const r = await siguienteNumeroRecibo(admin, "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-1000");
  });

  test("count null/undefined (respuesta rara de Supabase) se trata como 0, no como NaN", async () => {
    const admin = makeFakeAdminConCount({ count: null });
    const r = await siguienteNumeroRecibo(admin, "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-001");
  });

  test("error de Supabase se propaga, sin numero", async () => {
    const admin = makeFakeAdminConCount({ error: { message: "db down" } });
    const r = await siguienteNumeroRecibo(admin, "tenant-1", 2026);
    assert.strictEqual(r.numero, undefined);
    assert.deepStrictEqual(r.error, { message: "db down" });
  });
}
