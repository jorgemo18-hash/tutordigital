import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { derivarSustitucionParaRegistro } = await import("../../server/lib/academiaSustituciones/derivarAutoria.js");

  const TENANT_ID = "tenant-1";
  const PROFESOR_A = "profesor-a";
  const PROFESOR_B = "profesor-b";
  const ALUMNO_ID = "alumno-1";
  const FECHA = "2026-07-26";

  test("sin profesorId (registro sin autoría) -> null", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await derivarSustitucionParaRegistro(admin, { tenantId: TENANT_ID, profesorId: null, alumnoId: ALUMNO_ID, fecha: FECHA });
    assert.equal(res, null);
  });

  test("asignación directa -> null (no fue sustitución, es lo normal)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_A, alumno_id: ALUMNO_ID }],
    });
    const res = await derivarSustitucionParaRegistro(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_A, alumnoId: ALUMNO_ID, fecha: FECHA });
    assert.equal(res, null);
  });

  test("sin asignación directa pero con sustitución cubriendo esa fecha -> devuelve al sustituido", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: PROFESOR_B, display_name: "Bea" }],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_A, profesor_sustituido_id: PROFESOR_B, fecha_inicio: "2026-07-25", fecha_fin: "2026-07-27", created_at: "2026-07-25T08:00:00Z" },
      ],
    });
    const res = await derivarSustitucionParaRegistro(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_A, alumnoId: ALUMNO_ID, fecha: FECHA });
    assert.deepEqual(res, { profesor_sustituido_id: PROFESOR_B, sustituido_nombre: "Bea" });
  });

  test("sustitución YA REVOCADA sigue explicando un registro hecho DURANTE su vigencia (histórico, no se reescribe)", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: PROFESOR_B, display_name: "Bea" }],
      academia_sustituciones: [
        {
          tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_A, profesor_sustituido_id: PROFESOR_B,
          fecha_inicio: "2026-07-25", fecha_fin: "2026-07-27", created_at: "2026-07-25T08:00:00Z",
          revocada_at: "2026-07-28T00:00:00Z",
        },
      ],
    });
    const res = await derivarSustitucionParaRegistro(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_A, alumnoId: ALUMNO_ID, fecha: FECHA });
    assert.deepEqual(res, { profesor_sustituido_id: PROFESOR_B, sustituido_nombre: "Bea" });
  });

  test("sin asignación ni sustitución cubriendo esa fecha -> null", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_A, profesor_sustituido_id: PROFESOR_B, fecha_inicio: "2026-01-01", fecha_fin: "2026-01-02" },
      ],
    });
    const res = await derivarSustitucionParaRegistro(admin, { tenantId: TENANT_ID, profesorId: PROFESOR_A, alumnoId: ALUMNO_ID, fecha: FECHA });
    assert.equal(res, null);
  });
}
