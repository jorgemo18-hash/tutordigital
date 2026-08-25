// siguienteNumeroRecibo() — numeración de documentos, no cálculo de dinero,
// pero con las mismas consecuencias si se equivoca.
//
// La versión anterior contaba TODOS los recibos del tenant y sumaba 1, y
// estos tests fijaban ese comportamiento como si fuera correcto. Lo que
// producía, verificado en la BD real: un REC-2026-008 duplicado (uno en
// borrador y otro ya enviado a una familia), un hueco en el 006, y una
// serie que no reiniciaba en enero.
//
// Ahora se toma el MÁXIMO de la serie del año. Stub local mínimo: solo esta
// función usa este patrón de consulta en todo el repo.
function makeFakeAdmin({ filas = [], error = null } = {}) {
  const registro = { filtros: [] };
  const builder = {
    select() { return builder; },
    eq(col, val) { registro.filtros.push(`eq:${col}=${val}`); return builder; },
    like(col, patron) {
      registro.filtros.push(`like:${col}=${patron}`);
      if (error) return Promise.resolve({ data: null, error });
      const prefijo = patron.replace(/%$/, "");
      return Promise.resolve({
        data: filas.filter((f) => String(f.numero_recibo || "").startsWith(prefijo)),
        error: null,
      });
    },
  };
  return { registro, from() { return builder; } };
}

const num = (n) => ({ numero_recibo: n });

export async function run({ test, assert }) {
  const { siguienteNumeroRecibo } = await import("../../server/lib/academiaRecibos/calculos.js");

  test("sin recibos previos -> primer número del año", async () => {
    const r = await siguienteNumeroRecibo(makeFakeAdmin({ filas: [] }), "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-001");
  });

  test("con recibos previos -> el siguiente al mayor", async () => {
    const filas = [num("REC-2026-001"), num("REC-2026-002"), num("REC-2026-003")];
    const r = await siguienteNumeroRecibo(makeFakeAdmin({ filas }), "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-004");
  });

  test("REGRESIÓN: tras borrar un recibo NO se reutiliza su número", async () => {
    // Se emitieron 001..005 y se borró el 003. Con el contador anterior
    // (count=4 -> 005) se habría reemitido un número ya usado.
    const filas = [num("REC-2026-001"), num("REC-2026-002"), num("REC-2026-004"), num("REC-2026-005")];
    const r = await siguienteNumeroRecibo(makeFakeAdmin({ filas }), "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-006", "el hueco se queda como hueco");
  });

  test("REGRESIÓN: la serie reinicia en cada año natural", async () => {
    // 44 recibos de 2026 en la tabla; el primero de 2027 debe ser el 001.
    const filas = Array.from({ length: 44 }, (_, i) => num(`REC-2026-${String(i + 1).padStart(3, "0")}`));
    const admin = makeFakeAdmin({ filas });
    const r = await siguienteNumeroRecibo(admin, "tenant-1", 2027);
    assert.strictEqual(r.numero, "REC-2027-001");
    assert.ok(
      admin.registro.filtros.includes("like:numero_recibo=REC-2027-%"),
      "debe consultar solo la serie del año pedido"
    );
  });

  test("se consulta filtrando por tenant — la serie es por centro", async () => {
    const admin = makeFakeAdmin({ filas: [] });
    await siguienteNumeroRecibo(admin, "tenant-1", 2026);
    assert.ok(admin.registro.filtros.includes("eq:tenant_id=tenant-1"));
  });

  test("números fuera de formato se ignoran, no rompen la serie", async () => {
    const filas = [num("REC-2026-002"), num("REC-2026-abc"), num(null), num("REC-2026-")];
    const r = await siguienteNumeroRecibo(makeFakeAdmin({ filas }), "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-003");
  });

  test("contador de 4+ dígitos no se trunca (padStart es un mínimo, no un máximo)", async () => {
    const r = await siguienteNumeroRecibo(makeFakeAdmin({ filas: [num("REC-2026-999")] }), "tenant-1", 2026);
    assert.strictEqual(r.numero, "REC-2026-1000");
  });

  test("error de Supabase se propaga, sin numero", async () => {
    const r = await siguienteNumeroRecibo(makeFakeAdmin({ error: { message: "db down" } }), "tenant-1", 2026);
    assert.strictEqual(r.numero, undefined);
    assert.deepStrictEqual(r.error, { message: "db down" });
  });
}
