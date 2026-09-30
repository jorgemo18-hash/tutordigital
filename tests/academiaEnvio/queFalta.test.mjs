import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// "LO QUE FALTA" EN ENVÍO A FAMILIAS (Jorge, 30/09/2026): *"la lista de lo
// que falta, que si le clicas te ponga quién es"*. Ver
// assets/academia/admin/js/sections/envioFamilias/queFalta.js.
export async function run({ test, assert }) {
  const { queFalta, buildQueFalta } = await import("../../assets/academia/admin/js/sections/envioFamilias/queFalta.js");
  const { buildListItem } = await import("../../server/routes/v1/academia-recibos/listado.routes.js");

  const alumno = (id, nombre, extra = {}) => ({ id, nombre, tiene_sesiones: true, informe_redactado: false, informe_enviado_at: null, ...extra });
  const FAMILIAS = [
    { familia_id: "f1", familia_nombre: "Ruiz", recibo: null, alumnos_activos: [alumno("a1", "Eric")] },
    { familia_id: "f2", familia_nombre: "Pirla", recibo: { id: "r2" }, alumnos_activos: [alumno("a2", "Hugo", { informe_redactado: true })] },
    { familia_id: "f3", familia_nombre: "Val", recibo: { id: "r3" }, alumnos_activos: [alumno("a3", "Aarón"), alumno("a4", "Sin clases", { tiene_sesiones: false })] },
  ];
  const ctx = { mes: 10, periodoInforme: { mes: 9, anio: 2026 } };

  test("cuenta y nombra: recibos que faltan del mes del envío e informes sin redactar del mes del informe", () => {
    const [recibos, informes] = queFalta(FAMILIAS, ctx);
    assert.equal(recibos.titulo, "1 familia sin recibo de octubre");
    assert.deepEqual(recibos.personas.map((p) => p.etiqueta), ["Ruiz"]);
    assert.equal(informes.titulo, "2 informes de septiembre sin redactar");
    assert.deepEqual(informes.personas.map((p) => p.etiqueta), ["Aarón (Val)", "Eric (Ruiz)"]);
  });

  test("un alumno sin clases ese mes no tiene informe que falte; uno ya enviado, tampoco", () => {
    const [, informes] = queFalta(FAMILIAS, ctx);
    assert.ok(!informes.personas.some((p) => p.etiqueta.startsWith("Sin clases")));
    const enviado = [{ familia_id: "f", familia_nombre: "X", recibo: { id: "r" }, alumnos_activos: [alumno("a", "Ya", { informe_enviado_at: "2026-10-05" })] }];
    assert.deepEqual(queFalta(enviado, ctx), []);
  });

  test("al pulsar un nombre se abre SU familia", () => {
    const abiertas = [];
    const nodo = buildQueFalta(FAMILIAS, { ...ctx, onSelect: (f) => abiertas.push(f.familia_id) });
    const categoria = nodo.querySelector('[data-clave="informes"]');
    assert.ok(categoria, "la categoría se pinta");
    const aaron = [...categoria.querySelectorAll("button")].find((b) => b.textContent === "Aarón (Val)");
    aaron.click();
    assert.deepEqual(abiertas, ["f3"]);
  });

  test("sin nada pendiente lo dice con palabras, y sin familias no pinta nada", () => {
    const listas = [{ familia_id: "f", familia_nombre: "X", recibo: { id: "r" }, alumnos_activos: [alumno("a", "Ok", { informe_redactado: true })] }];
    assert.match(buildQueFalta(listas, ctx).textContent, /todo listo para enviar/);
    assert.equal(buildQueFalta([], ctx).textContent, "");
  });

  test("el listado del servidor manda `informe_redactado`, que es de lo que vive esta lista", () => {
    const item = buildListItem({
      familia: { id: "f1", nombre: "Ruiz" }, alumnosActivos: [{ id: "a1", nombre: "Eric" }], recibo: null,
      conSesiones: new Set(["a1"]), informesEnviados: {}, informesRedactados: new Set(["a1"]),
    });
    assert.equal(item.alumnos_activos[0].informe_redactado, true);
    assert.deepEqual(queFalta([item], ctx).map((c) => c.clave), ["recibos"]);
  });
  test("una familia cuyo único alumno se dio de baja sigue en la lista si tiene informe, y su informe cuenta como pendiente", async () => {
    const { separarPorAlumnosActivos } = await import("../../assets/academia/admin/js/sections/envioFamilias/familiasSinActivos.js");
    const soloBaja = {
      familia_id: "f9", familia_nombre: "Gil", recibo: null, alumnos_activos: [],
      alumnos_informe: [alumno("a9", "Nora", { de_baja: true })],
    };
    const { conActivos, sinActivos } = separarPorAlumnosActivos([soloBaja]);
    assert.equal(conActivos.length, 1);
    assert.equal(sinActivos.length, 0);
    const categorias = queFalta([soloBaja], ctx);
    assert.deepEqual(categorias.find((c) => c.clave === "informes").personas.map((p) => p.etiqueta), ["Nora (Gil)"]);
    assert.equal(categorias.find((c) => c.clave === "recibos"), undefined, "sin alumnos activos no le falta ningún recibo");
  });
}
