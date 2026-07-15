import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { fetchTextoInscripcion, guardarTextoInscripcion } = await import(
    "../server/lib/academiaDocumentos/inscripcionTexto.js"
  );

  test("fetchTextoInscripcion: sin fila todavía -> contenido vacío, no error", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_textos_legales: [] });
    const res = await fetchTextoInscripcion(admin, "tenant-1");
    assert.equal(res.contenido, "");
    assert.equal(res.error, undefined);
  });

  test("fetchTextoInscripcion: devuelve el contenido de la fila tipo inscripcion del tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_textos_legales: [
        { tenant_id: "tenant-1", tipo: "inscripcion", contenido: "Texto LOPD", created_at: "2026-01-01T00:00:00.000Z" },
        { tenant_id: "tenant-1", tipo: "email", contenido: "Otro texto", created_at: "2026-01-01T00:00:00.000Z" },
        { tenant_id: "tenant-2", tipo: "inscripcion", contenido: "De otro tenant", created_at: "2026-01-01T00:00:00.000Z" },
      ],
    });
    const res = await fetchTextoInscripcion(admin, "tenant-1");
    assert.equal(res.contenido, "Texto LOPD");
  });

  test("guardarTextoInscripcion: sin fila previa, crea una nueva con tipo inscripcion", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_textos_legales: [] });
    const res = await guardarTextoInscripcion(admin, "tenant-1", "Texto nuevo");
    assert.equal(res.ok, true);
    const filas = admin._state.tables.academia_textos_legales;
    assert.equal(filas.length, 1);
    assert.equal(filas[0].tenant_id, "tenant-1");
    assert.equal(filas[0].tipo, "inscripcion");
    assert.equal(filas[0].contenido, "Texto nuevo");
    assert.equal(filas[0].activo, true);
  });

  test("guardarTextoInscripcion: con fila previa, la actualiza en vez de crear una segunda", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_textos_legales: [
        { id: "existente-1", tenant_id: "tenant-1", tipo: "inscripcion", contenido: "Viejo", created_at: "2026-01-01T00:00:00.000Z" },
      ],
    });
    const res = await guardarTextoInscripcion(admin, "tenant-1", "Actualizado");
    assert.equal(res.ok, true);
    const filas = admin._state.tables.academia_textos_legales;
    assert.equal(filas.length, 1, "no debe crear una segunda fila");
    assert.equal(filas[0].contenido, "Actualizado");
  });

  test("guardarTextoInscripcion: no toca filas de otros tenants ni de otro tipo", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_textos_legales: [
        { id: "otro-tenant", tenant_id: "tenant-2", tipo: "inscripcion", contenido: "No tocar", created_at: "2026-01-01T00:00:00.000Z" },
        { id: "otro-tipo", tenant_id: "tenant-1", tipo: "email", contenido: "No tocar tampoco", created_at: "2026-01-01T00:00:00.000Z" },
      ],
    });
    await guardarTextoInscripcion(admin, "tenant-1", "Texto de tenant-1");
    const filas = admin._state.tables.academia_textos_legales;
    assert.equal(filas.length, 3, "crea una fila nueva para tenant-1, no toca las otras 2");
    assert.equal(filas.find((f) => f.id === "otro-tenant").contenido, "No tocar");
    assert.equal(filas.find((f) => f.id === "otro-tipo").contenido, "No tocar tampoco");
  });
}
