import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// NO SE COBRA ANTES DE EMPEZAR (Jorge, 30/09/2026): *"si Hugo empieza el 1
// de octubre pero ya lo tengo apuntado, en septiembre no lo voy a cobrar, y
// tampoco tendría que aparecer"*. Manda el horario, no la fecha_alta (que es
// histórica). Ver server/lib/academiaRecibos/empiezaEnElMes.js.
export async function run({ test, assert }) {
  const { empiezaEnElMesOAntes } = await import("../../server/lib/academiaRecibos/empiezaEnElMes.js");
  const { fetchPorEmitir } = await import("../../server/lib/academiaFinanzas/porEmitir.js");
  const { fetchFamiliasConAlumnos } = await import("../../server/lib/academiaRecibos/consultas.js");
  const SEP = { mes: 9, anio: 2026 };
  const OCT = { mes: 10, anio: 2026 };
  const h = (fecha_inicio, fecha_fin = null) => ({ fecha_inicio, fecha_fin });

  test("empieza el 1 de octubre: en septiembre no, en octubre sí (aunque su alta sea de enero)", () => {
    const alumno = { fechaAlta: "2026-01-16", horarios: [h("2026-10-01"), h("2026-10-01")] };
    assert.equal(empiezaEnElMesOAntes(alumno, SEP), false);
    assert.equal(empiezaEnElMesOAntes(alumno, OCT), true);
  });

  test("empieza a mitad de mes: ese mes ya se cobra (el ajuste es el descuento puntual)", () => {
    assert.equal(empiezaEnElMesOAntes({ horarios: [h("2026-09-21")] }, SEP), true);
    assert.equal(empiezaEnElMesOAntes({ horarios: [h("2026-09-30")] }, SEP), true);
  });

  test("vuelve en octubre con el horario del curso pasado cerrado: el viejo no cuenta", () => {
    const alumno = { fechaAlta: "2025-09-10", horarios: [h("2025-09-10", "2026-06-20"), h("2026-10-05")] };
    assert.equal(empiezaEnElMesOAntes(alumno, SEP), false);
    assert.equal(empiezaEnElMesOAntes(alumno, OCT), true);
  });

  test("todas sus franjas cerradas: no se le quita (la baja la decide `activo`, no esta regla)", () => {
    assert.equal(empiezaEnElMesOAntes({ horarios: [h("2026-09-23", "2026-09-23")] }, OCT), true);
  });

  test("sin horario manda la fecha_alta; sin nada, se cobra como siempre", () => {
    assert.equal(empiezaEnElMesOAntes({ fechaAlta: "2026-10-01" }, SEP), false);
    assert.equal(empiezaEnElMesOAntes({ fechaAlta: "2026-09-15" }, SEP), true);
    assert.equal(empiezaEnElMesOAntes({}, SEP), true);
  });

  const mundo = () => makeFakeSupabaseAdmin({
    academia_familias: [
      { id: "f1", tenant_id: "t1", nombre: "Pirla", email: "p@x.es", metodo_pago: "bizum", activa: true },
      { id: "f2", tenant_id: "t1", nombre: "Ruiz", email: "r@x.es", metodo_pago: "bizum", activa: true },
    ],
    academia_alumnos: [
      { id: "a1", tenant_id: "t1", nombre: "Hugo", curso: "1.º ESO", familia_id: "f1", fecha_alta: "2026-01-16", activo: true },
      { id: "a2", tenant_id: "t1", nombre: "Lola", curso: "2.º ESO", familia_id: "f2", fecha_alta: "2026-09-01", activo: true },
    ],
    academia_tarifas: [
      { alumno_id: "a1", tenant_id: "t1", precio_bruto: 100, descuento_pct: 0, fecha_fin: null },
      { alumno_id: "a2", tenant_id: "t1", precio_bruto: 80, descuento_pct: 0, fecha_fin: null },
    ],
    academia_horario: [
      { id: "h1", tenant_id: "t1", alumno_id: "a1", fecha_inicio: "2026-10-01", fecha_fin: null },
      { id: "h2", tenant_id: "t1", alumno_id: "a2", fecha_inicio: "2026-09-01", fecha_fin: null },
    ],
    academia_recibos: [],
  });

  test("Por emitir de septiembre no cuenta a Hugo; el de octubre sí", async () => {
    const sep = await fetchPorEmitir(mundo(), "t1", SEP);
    assert.equal(sep.error, undefined);
    assert.deepEqual(sep.detalle.map((d) => d.nombre), ["Ruiz"]);
    assert.equal(sep.importe, 80);
    const oct = await fetchPorEmitir(mundo(), "t1", OCT);
    assert.equal(oct.importe, 180);
  });

  test("la lista de familias del mes (base del lote de recibos) lo deja fuera; sin mes, lo devuelve", async () => {
    const { items } = await fetchFamiliasConAlumnos(mundo(), "t1", SEP);
    assert.deepEqual(items.find((i) => i.familia.id === "f1").alumnosActivos, []);
    const { items: todos } = await fetchFamiliasConAlumnos(mundo(), "t1");
    assert.equal(todos.find((i) => i.familia.id === "f1").alumnosActivos.length, 1);
  });
}
