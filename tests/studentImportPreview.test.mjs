import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// admin "veneno": las lecturas (.select/.eq/.order/.limit/...) funcionan de
// verdad contra el fake, pero cualquier escritura revienta inmediatamente.
// Si buildStudentImportPreview terminase sin lanzar, es la prueba de que en
// ningún punto llamó a insert/upsert/update/delete — la garantía explícita
// que pide la tarea ("la fase de previsualización no crea registros").
function poisonWrites(admin) {
  return {
    ...admin,
    from(table) {
      const builder = admin.from(table);
      return {
        ...builder,
        insert() { throw new Error(`preview no debe insertar en "${table}"`); },
        upsert() { throw new Error(`preview no debe hacer upsert en "${table}"`); },
        update() { throw new Error(`preview no debe actualizar "${table}"`); },
        delete() { throw new Error(`preview no debe borrar en "${table}"`); },
      };
    },
    auth: {
      admin: {
        getUserById: async () => { throw new Error("preview no debería necesitar resolver más usuarios de los del tenant"); },
      },
    },
  };
}

function csvBuffer(text) {
  return Buffer.from(text, "utf-8");
}

export async function run({ test, assert }) {
  const { buildStudentImportPreview, IMPORT_MAX_BYTES } = await import("../server/lib/studentImportPreview.js");

  test("preview: archivo .csv válido -> filas 'listo', y NO persiste nada (admin veneno no revienta)", async () => {
    const fake = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const admin = poisonWrites(fake);
    const buffer = csvBuffer("Nombre,Email\nAna García,ana@a.com\nLuis Pérez,luis@a.com\n");

    const result = await buildStudentImportPreview({ admin, tenantId: "t1", buffer, filename: "alumnos.csv" });

    assert.equal(Array.isArray(result.rows), true);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows.map((r) => r.status), ["listo", "listo"]);
  });

  test("preview: no manda ningún email — la función ni siquiera recibe un remitente de correo", async () => {
    const fake = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const admin = poisonWrites(fake);
    const buffer = csvBuffer("Nombre,Email\nAna,ana@a.com\n");
    // buildStudentImportPreview no acepta parámetro `sendEmail` en absoluto —
    // si esta llamada completa sin lanzar, es estructuralmente imposible que
    // se haya enviado un correo desde dentro.
    const result = await buildStudentImportPreview({ admin, tenantId: "t1", buffer, filename: "alumnos.csv" });
    assert.equal(result.error, undefined);
  });

  test("preview: marca como duplicado a quien ya existe en el centro (fila students), con su estado actual", async () => {
    const fake = makeFakeSupabaseAdmin({
      student_invites: [],
      students: [{ id: "s1", tenant_id: "t1", user_id: "u1", group_id: "g1", approval_status: "approved", created_at: "2026-01-01T00:00:00Z" }],
    });
    const admin = poisonWrites(fake);
    admin.auth.admin.getUserById = async (userId) =>
      userId === "u1" ? { data: { user: { email: "existe@a.com" } } } : { data: { user: null } };

    const buffer = csvBuffer("Nombre,Email\nYa Existe,existe@a.com\nNuevo,nuevo@a.com\n");
    const result = await buildStudentImportPreview({ admin, tenantId: "t1", buffer, filename: "alumnos.csv" });

    assert.equal(result.rows[0].status, "duplicado");
    assert.ok(result.rows[0].reason.includes("Activo"));
    assert.equal(result.rows[1].status, "listo");
  });

  test("preview: archivo .xlsx real (no solo CSV) también se parsea correctamente", async () => {
    const fake = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const admin = poisonWrites(fake);
    const path = await import("node:path");
    const url = await import("node:url");
    const fs = await import("node:fs");
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const fixturePath = path.join(here, "fixtures", "import-alumnos.xlsx");
    const buffer = fs.readFileSync(fixturePath);

    const result = await buildStudentImportPreview({ admin, tenantId: "t1", buffer, filename: "import-alumnos.xlsx" });
    assert.equal(Array.isArray(result.rows), true);
    assert.ok(result.rows.length >= 1);
  });

  test("preview: archivo por encima de 2MB -> error file_too_large, sin intentar parsear", async () => {
    const fake = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const admin = poisonWrites(fake);
    const bigBuffer = Buffer.alloc(IMPORT_MAX_BYTES + 1, "a");
    const result = await buildStudentImportPreview({ admin, tenantId: "t1", buffer: bigBuffer, filename: "grande.csv" });
    assert.equal(result.error, "file_too_large");
  });

  test("preview: extensión no soportada -> error unsupported_file_type", async () => {
    const fake = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const admin = poisonWrites(fake);
    const buffer = csvBuffer("Nombre,Email\nAna,ana@a.com\n");
    const result = await buildStudentImportPreview({ admin, tenantId: "t1", buffer, filename: "alumnos.pdf" });
    assert.equal(result.error, "unsupported_file_type");
  });

  test("preview: más de 500 filas -> error too_many_rows", async () => {
    const fake = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const admin = poisonWrites(fake);
    const lines = ["Nombre,Email", ...Array.from({ length: 501 }, (_, i) => `N${i},n${i}@a.com`)];
    const result = await buildStudentImportPreview({ admin, tenantId: "t1", buffer: csvBuffer(lines.join("\n")), filename: "alumnos.csv" });
    assert.equal(result.error, "too_many_rows");
    assert.equal(result.received, 501);
  });
}
