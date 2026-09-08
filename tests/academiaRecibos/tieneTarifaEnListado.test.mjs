import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// `tiene_tarifa` en el listado de familias con alumnos.
//
// POR QUÉ ESTE TEST EXISTE Y ES UNA REGRESIÓN DE VERDAD. El aviso del panel
// de envío (assets/.../envioFamilias/alumnosSinPrecio.js) CALLA a propósito
// cuando el campo no viene: sin él no hay forma de distinguir "se me olvidó
// ponerle precio" de "este alumno no paga a propósito", y prefiere no decir
// nada antes que acusar en falso a veinte familias.
//
// Eso es lo correcto para el aviso, pero deja un agujero: si alguien quita
// esta línea del backend, el aviso se apaga EN SILENCIO. No falla ningún
// test de frontend (los suyos pasan el campo a mano), no hay error en
// consola, y el fallo que arreglaba —un recibo de 0 € enviado a una familia
// real— vuelve tal cual. Este test es el único sitio donde eso se rompería.
//
// El caso real: en el cierre de septiembre de 2026 había en producción un
// alumno activo sin tarifa entre 20 familias, y el lote lo habría facturado
// a 0 € sin avisar.
export async function run({ test, assert }) {
  const { fetchFamiliasConAlumnos } = await import("../../server/lib/academiaRecibos/consultas.js");

  const TENANT = "t1";

  function admin({ tarifas }) {
    return makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: TENANT, nombre: "Familia Uno", email: "f@example.com", metodo_pago: "efectivo", activa: true }],
      academia_alumnos: [
        { id: "conPrecio", tenant_id: TENANT, nombre: "Ana", curso: "1º ESO", familia_id: "f1", fecha_alta: "2026-09-01", activo: true },
        { id: "sinTarifa", tenant_id: TENANT, nombre: "Santiago", curso: "4º ESO", familia_id: "f1", fecha_alta: "2026-09-01", activo: true },
        { id: "gratis", tenant_id: TENANT, nombre: "Becado", curso: "2º ESO", familia_id: "f1", fecha_alta: "2026-09-01", activo: true },
      ],
      academia_tarifas: tarifas,
    });
  }

  const TARIFAS = [
    { tenant_id: TENANT, alumno_id: "conPrecio", precio_bruto: 70, descuento_pct: 0, fecha_fin: null },
    // Tarifa EXPLÍCITA de 0 €: una beca. No es lo mismo que no tenerla.
    { tenant_id: TENANT, alumno_id: "gratis", precio_bruto: 0, descuento_pct: 0, fecha_fin: null },
  ];

  async function alumnosDeLaFamilia(tarifas) {
    const { items, error } = await fetchFamiliasConAlumnos(admin({ tarifas }), TENANT);
    assert.equal(error, undefined, "el listado no debería fallar");
    return Object.fromEntries(items[0].alumnosActivos.map((a) => [a.id, a]));
  }

  test("REGRESIÓN: el alumno SIN tarifa vigente sale con tiene_tarifa=false", async () => {
    const porId = await alumnosDeLaFamilia(TARIFAS);
    assert.equal(porId.sinTarifa.tiene_tarifa, false);
    assert.equal(porId.sinTarifa.precio_bruto, 0);
  });

  test("REGRESIÓN: una tarifa de 0 € sale con tiene_tarifa=TRUE — es una decisión, no un olvido", async () => {
    // Este es el par que da sentido al campo: los dos alumnos tienen
    // precio_bruto 0 y solo `tiene_tarifa` los separa. Si alguna vez
    // devuelven lo mismo, el aviso del panel o miente o se vuelve ruido.
    const porId = await alumnosDeLaFamilia(TARIFAS);
    assert.equal(porId.gratis.tiene_tarifa, true);
    assert.equal(porId.gratis.precio_bruto, 0);
    assert.equal(porId.gratis.precio_bruto, porId.sinTarifa.precio_bruto, "mismo importe...");
    assert.notEqual(porId.gratis.tiene_tarifa, porId.sinTarifa.tiene_tarifa, "...y aun así distinguibles");
  });

  test("el alumno con precio normal sigue saliendo como siempre", async () => {
    const porId = await alumnosDeLaFamilia(TARIFAS);
    assert.equal(porId.conPrecio.tiene_tarifa, true);
    assert.equal(porId.conPrecio.precio_bruto, 70);
  });

  test("sin ninguna tarifa en la tabla, los tres salen con tiene_tarifa=false", async () => {
    // La consulta de tarifas ni siquiera se lanza si no hay alumnos; con
    // alumnos pero sin tarifas debe devolver el flag en false, no undefined
    // (undefined haría callar al aviso — ver alumnosSinPrecio.js).
    const porId = await alumnosDeLaFamilia([]);
    for (const id of ["conPrecio", "sinTarifa", "gratis"]) {
      assert.equal(porId[id].tiene_tarifa, false, `${id} debería salir sin tarifa`);
    }
  });
}
