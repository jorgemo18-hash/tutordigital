import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// Editar una entrada de la lista de espera.
//
// Antes no se podía: corregir un dígito de un teléfono obligaba a borrar
// el contacto y volver a escribirlo, y el borrado es un DELETE real sin
// papelera. Es decir, el camino para arreglar una errata pasaba por
// destruir el dato.
export async function run({ test, assert }) {
  const { actualizarEntradaListaEspera, crearEntradaListaEspera } = await import(
    "../../server/lib/academiaListaEspera/gestion.js"
  );

  const TENANT_ID = "tenant-1";
  const entradaBase = () => ({
    id: "e1", tenant_id: TENANT_ID, nombre: "Marta Pérez", curso: "3º ESO",
    telefono: "612345678", email: "marta@example.com", notas: "Prefiere tardes",
    created_at: "2026-07-01T00:00:00Z",
  });

  test("cambia solo el campo indicado", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [entradaBase()] });
    const r = await actualizarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "e1", cambios: { telefono: "699999999" } });
    assert.equal(r.ok, true);
    const fila = admin._state.tables.academia_lista_espera[0];
    assert.equal(fila.telefono, "699999999");
    assert.equal(fila.nombre, "Marta Pérez", "lo no mencionado no se toca");
    assert.equal(fila.notas, "Prefiere tardes");
  });

  test("REGRESIÓN: un campo ausente del parche NO se borra", async () => {
    // Un PATCH que escribiera el objeto entero vaciaría en el servidor lo
    // que el formulario no estuviera mostrando en ese momento.
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [entradaBase()] });
    await actualizarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "e1", cambios: { nombre: "Marta P." } });
    const fila = admin._state.tables.academia_lista_espera[0];
    assert.equal(fila.email, "marta@example.com");
    assert.equal(fila.telefono, "612345678");
    assert.equal(fila.curso, "3º ESO");
  });

  test("vaciar un campo a propósito sí lo pone a null, no a cadena vacía", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [entradaBase()] });
    await actualizarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "e1", cambios: { email: "" } });
    assert.equal(admin._state.tables.academia_lista_espera[0].email, null);
  });

  test("un parche vacío no lanza una escritura inútil", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [entradaBase()] });
    const r = await actualizarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "e1", cambios: {} });
    assert.deepEqual(r, { ok: false, code: "sin_cambios" });
  });

  test("claves desconocidas se ignoran, no llegan a la tabla", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [entradaBase()] });
    const r = await actualizarEntradaListaEspera(admin, {
      tenantId: TENANT_ID, id: "e1", cambios: { tenant_id: "otro", id: "otro", notas: "Nueva nota" },
    });
    assert.equal(r.ok, true);
    const fila = admin._state.tables.academia_lista_espera[0];
    assert.equal(fila.tenant_id, TENANT_ID, "no se puede reasignar de centro por el body");
    assert.equal(fila.id, "e1");
    assert.equal(fila.notas, "Nueva nota");
  });

  test("REGRESIÓN: no se edita una entrada de OTRO centro", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_lista_espera: [{ ...entradaBase(), tenant_id: "otro-tenant" }],
    });
    const r = await actualizarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "e1", cambios: { nombre: "Robado" } });
    assert.deepEqual(r, { ok: false, code: "not_found" });
    assert.equal(admin._state.tables.academia_lista_espera[0].nombre, "Marta Pérez");
  });

  test("id inexistente -> not_found", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [] });
    const r = await actualizarEntradaListaEspera(admin, { tenantId: TENANT_ID, id: "nope", cambios: { nombre: "X" } });
    assert.deepEqual(r, { ok: false, code: "not_found" });
  });

  test("el email se guarda al crear, y vacío queda como null", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_lista_espera: [] });
    const conEmail = await crearEntradaListaEspera(admin, { tenantId: TENANT_ID, nombre: "Ana", email: "ana@example.com" });
    assert.equal(conEmail.entrada.email, "ana@example.com");
    const sinEmail = await crearEntradaListaEspera(admin, { tenantId: TENANT_ID, nombre: "Luis", email: "   " });
    assert.equal(sinEmail.entrada.email, null, "un email en blanco no es un email");
  });
}
