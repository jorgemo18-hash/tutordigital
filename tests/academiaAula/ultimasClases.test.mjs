import { Window } from "happy-dom";
import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// «ÚLTIMAS CLASES» EN EL DIARIO (Jorge, 1/10/2026): al abrir un alumno, las
// cinco últimas clases antes de ese día, con materia y tema.
export async function run({ test, assert }) {
  const { fetchSesionesRecientes, bloquesDeSesion } = await import("../../server/lib/academiaDiario/sesionesRecientes.js");
  const { buildUltimasClases, fechaCorta, textoDeBloques } = await import("../../assets/academia/aula/js/diario/ultimasClases.js");
  const { createDiarioDrawer } = await import("../../assets/academia/aula/js/diario/diarioDrawer.js");
  const { createApp } = await import("../../server/app.js");
  const tick = () => new Promise((r) => setTimeout(r, 0));

  const ses = (fecha, extra = {}) => ({ tenant_id: "t1", alumno_id: "a1", tipo: "clase", fecha, asignatura: "Matemáticas", tema: `tema ${fecha}`, asignaturas: [], ...extra });

  test("las cinco últimas CLASES antes del día, de la más reciente a la más antigua", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_sesiones: [
        ses("2026-09-10"), ses("2026-09-15"), ses("2026-09-17"), ses("2026-09-22"), ses("2026-09-24"),
        ses("2026-09-29"),
        ses("2026-09-30", { tipo: "ausencia", asignatura: null, tema: null }),
        ses("2026-10-01"), // el día que se escribe: ya está en el formulario
        ses("2026-09-28", { alumno_id: "otro" }),
        ses("2026-09-28", { tenant_id: "otra-academia" }),
      ],
    });
    const { sesiones, error } = await fetchSesionesRecientes(admin, { tenantId: "t1", alumnoId: "a1", antesDe: "2026-10-01" });
    assert.equal(error, undefined);
    assert.deepEqual(sesiones.map((s) => s.fecha), ["2026-09-29", "2026-09-24", "2026-09-22", "2026-09-17", "2026-09-15"]);
    assert.deepEqual(sesiones[0].bloques, [{ materia: "Matemáticas", tema: "tema 2026-09-29" }]);
  });

  test("las asignaturas: el formato de varios bloques, el antiguo suelto, y nunca el comentario", () => {
    assert.deepEqual(bloquesDeSesion({ asignaturas: [{ nombre: "Inglés", tema: "Present simple" }, { nombre: "Lengua", tema: "" }], comentario: "privado" }),
      [{ materia: "Inglés", tema: "Present simple" }, { materia: "Lengua", tema: "" }]);
    assert.deepEqual(bloquesDeSesion({ asignaturas: [], asignatura: "Física", tema: "MRU" }), [{ materia: "Física", tema: "MRU" }]);
    assert.deepEqual(bloquesDeSesion({ asignaturas: null, asignatura: null }), []);
  });

  test("en el drawer: fecha corta y «materia — tema», o el aviso de que no hay anteriores", async () => {
    assert.equal(fechaCorta("2026-09-29"), "29/09");
    assert.equal(textoDeBloques([{ materia: "Matemáticas", tema: "Fracciones" }, { materia: "Inglés", tema: "" }]), "Matemáticas — Fracciones · Inglés");
    const pedidos = [];
    const el = buildUltimasClases({ alumno_id: "a1" }, "2026-10-01", {
      fetchRecientesFn: async (id, f) => { pedidos.push([id, f]); return [{ fecha: "2026-09-29", bloques: [{ materia: "Matemáticas", tema: "Fracciones" }] }]; },
    });
    await tick();
    assert.deepEqual(pedidos, [["a1", "2026-10-01"]]);
    assert.match(el.textContent, /Últimas clases.*29\/09.*Matemáticas — Fracciones/);
    const vacio = buildUltimasClases({ alumno_id: "a1" }, "2026-10-01", { fetchRecientesFn: async () => [] });
    await tick();
    assert.match(vacio.textContent, /Todavía no hay clases anteriores/);
    const mal = buildUltimasClases({ alumno_id: "a1" }, "2026-10-01", { fetchRecientesFn: async () => { throw new Error("x"); } });
    await tick();
    assert.match(mal.textContent, /No se pudieron cargar/);
  });

  test("al abrir un alumno en el Diario salen sus últimas clases, también si estaba ausente", async () => {
    const root = document.createElement("div");
    const pedidos = [];
    const drawer = createDiarioDrawer(root, { fetchRecientesFn: async (id, f) => { pedidos.push([id, f]); return [{ fecha: "2026-09-29", bloques: [{ materia: "Inglés", tema: "Present simple" }] }]; } });
    drawer.open({ alumno_id: "a1", nombre: "Ana", curso: "1º ESO", nivel: "eso", horarios: [] }, "2026-10-01", { onGuardado: () => {} });
    await tick();
    assert.deepEqual(pedidos, [["a1", "2026-10-01"]]);
    assert.match(root.querySelector(".ac-drawer-body").textContent, /Últimas clases.*Inglés — Present simple/);
  });

  test("wiring: GET /api/v1/academia/diario/recientes existe y exige sesión", async () => {
    const app = await createApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/academia/diario/recientes?alumno_id=00000000-0000-4000-8000-000000000001&antes=2026-10-01" });
    await app.close();
    assert.ok([400, 401, 403].includes(res.statusCode), `recibió ${res.statusCode}`);
    assert.notEqual(res.statusCode, 404);
  });
}
