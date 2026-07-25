import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// El fake compartido no simula EXCLUDE constraints de Postgres (es un
// mock genérico, no reimplementa GiST) — wrapper local que replica el
// comportamiento exacto de la migración 098 sobre .insert(): mismo par
// sustituto/sustituido, ambos rangos CERRADOS (daterange('[]'), fin
// inclusive) que se solapen, y solo entre filas no revocadas. Así se
// puede probar el manejo del error real (crearSustitucion -> code:
// "solape") sin depender de una Postgres real.
function conExcludeSimulado(admin) {
  return {
    from(table) {
      const builder = admin.from(table);
      if (table !== "academia_sustituciones") return builder;
      const insertOriginal = builder.insert.bind(builder);
      builder.insert = (row) => {
        const filas = admin._state.tables.academia_sustituciones || [];
        const solapa = filas.some((f) =>
          f.revocada_at == null
          && f.profesor_sustituto_id === row.profesor_sustituto_id
          && f.profesor_sustituido_id === row.profesor_sustituido_id
          && row.fecha_inicio <= f.fecha_fin
          && f.fecha_inicio <= row.fecha_fin
        );
        if (solapa) {
          const fail = {
            select: () => ({
              single: () => Promise.resolve({
                data: null,
                error: { code: "23P01", message: 'conflicting key value violates exclusion constraint "academia_sustituciones_sin_solape"' },
              }),
            }),
          };
          return fail;
        }
        return insertOriginal(row);
      };
      return builder;
    },
    _state: admin._state,
  };
}

export async function run({ test, assert }) {
  const { crearSustitucion } = await import("../../server/lib/academiaSustituciones/gestion.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const SUSTITUTO_ID = "profesor-sustituto";
  const SUSTITUIDO_ID = "profesor-sustituido";

  function seedBase(sustituciones = []) {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: SUSTITUTO_ID, tenant_slug: TENANT_SLUG, display_name: "Ana", is_active: true },
        { id: SUSTITUIDO_ID, tenant_slug: TENANT_SLUG, display_name: "Bea", is_active: true },
      ],
      academia_sustituciones: sustituciones,
    });
    return conExcludeSimulado(admin);
  }

  function crear(admin, fechaInicio, fechaFin) {
    return crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio, fechaFin, declaradaPor: "user-1", origen: "autodeclarada",
    });
  }

  test("REGRESIÓN — duplicado exacto (mismo par, mismas fechas) -> error legible 'solape'", async () => {
    const admin = seedBase([{
      id: "s1", tenant_id: TENANT_ID, profesor_sustituto_id: SUSTITUTO_ID, profesor_sustituido_id: SUSTITUIDO_ID,
      fecha_inicio: "2026-07-25", fecha_fin: "2026-07-25", revocada_at: null,
    }]);
    const resultado = await crear(admin, "2026-07-25", "2026-07-25");
    assert.deepEqual(resultado, { ok: false, code: "solape" });
    assert.equal(admin._state.tables.academia_sustituciones.length, 1, "no debe insertarse la fila duplicada");
  });

  test("REGRESIÓN — rangos solapados parcialmente -> error legible 'solape'", async () => {
    const admin = seedBase([{
      id: "s1", tenant_id: TENANT_ID, profesor_sustituto_id: SUSTITUTO_ID, profesor_sustituido_id: SUSTITUIDO_ID,
      fecha_inicio: "2026-08-01", fecha_fin: "2026-08-10", revocada_at: null,
    }]);
    const resultado = await crear(admin, "2026-08-05", "2026-08-15");
    assert.deepEqual(resultado, { ok: false, code: "solape" });
  });

  test("REGRESIÓN — rangos contiguos SIN solape (1-5 y 6-10) -> permitido", async () => {
    const admin = seedBase([{
      id: "s1", tenant_id: TENANT_ID, profesor_sustituto_id: SUSTITUTO_ID, profesor_sustituido_id: SUSTITUIDO_ID,
      fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05", revocada_at: null,
    }]);
    const resultado = await crear(admin, "2026-08-06", "2026-08-10");
    assert.equal(resultado.ok, true);
    assert.equal(admin._state.tables.academia_sustituciones.length, 2);
  });

  test("REGRESIÓN — declarar de nuevo tras revocar la anterior (mismas fechas) -> permitido", async () => {
    const admin = seedBase([{
      id: "s1", tenant_id: TENANT_ID, profesor_sustituto_id: SUSTITUTO_ID, profesor_sustituido_id: SUSTITUIDO_ID,
      fecha_inicio: "2026-07-25", fecha_fin: "2026-07-25", revocada_at: "2026-07-25T22:00:00Z", revocada_por: "admin-1",
    }]);
    const resultado = await crear(admin, "2026-07-25", "2026-07-25");
    assert.equal(resultado.ok, true, "una fila revocada no debe contar para el constraint (WHERE revocada_at IS NULL)");
  });

  test("un solape con OTRO par de profesores no bloquea (el constraint es por pareja exacta)", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: SUSTITUTO_ID, tenant_slug: TENANT_SLUG, display_name: "Ana", is_active: true },
        { id: SUSTITUIDO_ID, tenant_slug: TENANT_SLUG, display_name: "Bea", is_active: true },
        { id: "profesor-otro", tenant_slug: TENANT_SLUG, display_name: "Carlos", is_active: true },
      ],
      academia_sustituciones: [{
        id: "s1", tenant_id: TENANT_ID, profesor_sustituto_id: SUSTITUTO_ID, profesor_sustituido_id: "profesor-otro",
        fecha_inicio: "2026-07-25", fecha_fin: "2026-07-25", revocada_at: null,
      }],
    });
    const wrapped = conExcludeSimulado(admin);
    const resultado = await crearSustitucion(wrapped, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-25", fechaFin: "2026-07-25", declaradaPor: "user-1", origen: "autodeclarada",
    });
    assert.equal(resultado.ok, true);
  });
}
