import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { fetchListaEsperaDelTenant } = await import("../../server/lib/academiaListaEspera/consultas.js");

  const TENANT_ID = "tenant-1";

  test("devuelve solo las entradas del tenant pedido, ordenadas por created_at ascendente", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_lista_espera: [
        { id: "e1", tenant_id: TENANT_ID, nombre: "Marta", curso: "3º ESO", telefono: "612345678", notas: null, created_at: "2026-07-02T10:00:00Z" },
        { id: "e2", tenant_id: "otro-tenant", nombre: "Ajeno", curso: null, telefono: null, notas: null, created_at: "2026-07-01T10:00:00Z" },
        { id: "e3", tenant_id: TENANT_ID, nombre: "Diego", curso: "5º PRIM", telefono: null, notas: "Prefiere tardes", created_at: "2026-07-01T10:00:00Z" },
      ],
    });

    const { entradas, error } = await fetchListaEsperaDelTenant(admin, TENANT_ID);
    assert.equal(error, undefined);
    assert.equal(entradas.length, 2);
    assert.deepEqual(entradas.map((e) => e.id), ["e3", "e1"]);
    assert.equal(entradas.some((e) => e.nombre === "Ajeno"), false);
  });

  test("tenant sin ninguna entrada -> array vacío, no error", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [] });
    const { entradas, error } = await fetchListaEsperaDelTenant(admin, TENANT_ID);
    assert.equal(error, undefined);
    assert.deepEqual(entradas, []);
  });
}
