import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { crearEntradaListaEspera, eliminarEntradaListaEspera } = await import(
    "../../server/lib/academiaListaEspera/gestion.js"
  );

  const TENANT_ID = "tenant-1";

  test("crearEntradaListaEspera inserta la fila con tenant_id y campos esperados", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [] });
    const resultado = await crearEntradaListaEspera(admin, {
      tenantId: TENANT_ID, nombre: "Marta Pérez", curso: "3º ESO", telefono: "612345678", notas: "Prefiere tardes",
    });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.entrada.nombre, "Marta Pérez");
    const filas = admin._state.tables.academia_lista_espera;
    assert.equal(filas.length, 1);
    assert.equal(filas[0].tenant_id, TENANT_ID);
  });

  test("crearEntradaListaEspera guarda null (no cadena vacía) para curso/telefono/notas ausentes", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [] });
    const resultado = await crearEntradaListaEspera(admin, { tenantId: TENANT_ID, nombre: "Solo Nombre" });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.entrada.curso, null);
    assert.equal(resultado.entrada.telefono, null);
    assert.equal(resultado.entrada.notas, null);
  });

  test("eliminarEntradaListaEspera borra la fila del tenant correcto", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_lista_espera: [{ id: "e1", tenant_id: TENANT_ID, nombre: "Marta", curso: null, telefono: null, notas: null, created_at: "2026-07-01T00:00:00Z" }],
    });
    const resultado = await eliminarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "e1" });
    assert.equal(resultado.ok, true);
    assert.deepEqual(admin._state.tables.academia_lista_espera, []);
  });

  test("eliminarEntradaListaEspera no borra una entrada de OTRO tenant -> not_found", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_lista_espera: [{ id: "e1", tenant_id: "otro-tenant", nombre: "Ajeno", curso: null, telefono: null, notas: null, created_at: "2026-07-01T00:00:00Z" }],
    });
    const resultado = await eliminarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "e1" });
    assert.deepEqual(resultado, { ok: false, code: "not_found" });
    assert.equal(admin._state.tables.academia_lista_espera.length, 1);
  });

  test("eliminarEntradaListaEspera con id inexistente -> not_found", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [] });
    const resultado = await eliminarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "no-existe" });
    assert.deepEqual(resultado, { ok: false, code: "not_found" });
  });
}
