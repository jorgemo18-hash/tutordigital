// EL LÍMITE DIARIO YA NO DEJA PASAR CUANDO FALLA LA BASE DE DATOS.
// Antes: `catch { return { ok: true } }` y ningún `error` mirado.
export async function run({ test, assert }) {
  const { comprobarLimiteDiario } = await import("../../server/lib/chat/limiteDiario.js");

  function fakeAdmin({ tenant = { id: "t", daily_message_limit: 3 }, alumno = { id: "s" }, sesiones = [{ id: "x" }], count = 0, fallaEn = null } = {}) {
    const datos = { tenants: tenant, students: alumno, tutor_sessions: sesiones };
    return {
      from(tabla) {
        const q = {
          select() { return q; }, eq() { return q; }, in() { return q; }, gte() { return q; },
          maybeSingle: async () => (fallaEn === tabla ? { data: null, error: { message: "caído" } } : { data: datos[tabla], error: null }),
          then(r) {
            if (fallaEn === tabla) return r({ data: null, count: null, error: { message: "caído" } });
            if (tabla === "session_messages") return r({ count, error: null });
            return r({ data: datos[tabla], error: null });
          },
        };
        return q;
      },
    };
  }
  const args = { userId: "u", tenantSlug: "c" };

  test("por debajo del límite, puede escribir; en el límite, no", async () => {
    assert.deepEqual(await comprobarLimiteDiario(fakeAdmin({ count: 2 }), args), { ok: true });
    assert.equal((await comprobarLimiteDiario(fakeAdmin({ count: 3 }), args)).motivo, "limite");
  });

  for (const tabla of ["tenants", "students", "tutor_sessions", "session_messages"]) {
    test(`REGRESIÓN: si falla ${tabla}, NO deja pasar`, async () => {
      const r = await comprobarLimiteDiario(fakeAdmin({ fallaEn: tabla }), args);
      assert.equal(r.ok, false);
      assert.equal(r.motivo, "error");
    });
  }

  test("REGRESIÓN: una excepción tampoco deja pasar", async () => {
    const r = await comprobarLimiteDiario({ from() { throw new Error("boom"); } }, args);
    assert.equal(r.motivo, "error");
  });

  test("quien no es alumno del centro (un profesor probando) no tiene límite", async () => {
    assert.deepEqual(await comprobarLimiteDiario(fakeAdmin({ alumno: null }), args), { ok: true });
  });
}
