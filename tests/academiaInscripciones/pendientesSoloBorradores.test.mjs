// REGRESIÓN: "inscripciones pendientes de revisar" debe contar SOLO
// borradores de OCR (activo=false, sin fecha_baja).
//
// Antes de la migración 103, este listado sumaba además los alumnos ACTIVOS
// con cuenta de tutor creada que aún no habían entrado al tutor
// (RPC academia_alumnos_pendientes_confirmacion). Como el alta rellena
// student_id y acceso_activado solo lo cambia el propio alumno al usar el
// tutor, en un centro que aún no ha repartido el tutor eso significaba que
// TODA la academia aparecía bajo el banner ámbar — y a la vez desaparecía
// de la pestaña Activos.
//
// Este test falla si alguien vuelve a llamar a esa RPC desde aquí: el
// cliente falso registra cualquier .rpc() y la aserción exige cero llamadas.
function makeFakeAdmin(filas) {
  const llamadas = { rpc: [], from: [], filtros: [] };

  const queryBuilder = {
    select() { return this; },
    eq(col, val) { llamadas.filtros.push(`eq:${col}=${val}`); return this; },
    is(col, val) { llamadas.filtros.push(`is:${col}=${val}`); return this; },
    order() { return Promise.resolve({ data: filas, error: null }); },
  };

  return {
    llamadas,
    from(tabla) { llamadas.from.push(tabla); return queryBuilder; },
    rpc(nombre) { llamadas.rpc.push(nombre); return Promise.resolve({ data: [], error: null }); },
  };
}

export async function run({ test, assert }) {
  const { fetchInscripcionesPendientes } = await import(
    "../../server/lib/academiaInscripciones/pendientes.js"
  );

  test("no llama a ninguna RPC — el banner solo cuenta borradores", async () => {
    const admin = makeFakeAdmin([{ id: "b1", nombre: "Borrador" }]);
    await fetchInscripcionesPendientes(admin, "tenant-1");
    assert.deepEqual(
      admin.llamadas.rpc,
      [],
      "no debe consultarse academia_alumnos_pendientes_confirmacion desde este listado"
    );
  });

  test("filtra por tenant, activo=false y fecha_baja nula (excluye archivados)", async () => {
    const admin = makeFakeAdmin([]);
    await fetchInscripcionesPendientes(admin, "tenant-1");
    assert.deepEqual(admin.llamadas.from, ["academia_alumnos"]);
    assert.ok(admin.llamadas.filtros.includes("eq:tenant_id=tenant-1"), "debe filtrar por tenant");
    assert.ok(admin.llamadas.filtros.includes("eq:activo=false"), "solo borradores");
    assert.ok(admin.llamadas.filtros.includes("is:fecha_baja=null"), "los archivados quedan fuera");
  });

  test("devuelve las filas tal cual y [] cuando no hay ninguna", async () => {
    const filas = [{ id: "b1" }, { id: "b2" }];
    const conDatos = await fetchInscripcionesPendientes(makeFakeAdmin(filas), "t");
    assert.deepEqual(conDatos.alumnos, filas);

    const vacio = await fetchInscripcionesPendientes(makeFakeAdmin(null), "t");
    assert.deepEqual(vacio.alumnos, [], "null de Supabase se normaliza a []");
  });

  test("propaga el error de Supabase en vez de devolver una lista vacía", async () => {
    const admin = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          is() { return this; },
          order() { return Promise.resolve({ data: null, error: { message: "boom" } }); },
        };
      },
      rpc() { throw new Error("no debería llamarse"); },
    };
    const { error, alumnos } = await fetchInscripcionesPendientes(admin, "t");
    assert.equal(error?.message, "boom");
    assert.equal(alumnos, undefined, "con error no se devuelve lista");
  });
}
