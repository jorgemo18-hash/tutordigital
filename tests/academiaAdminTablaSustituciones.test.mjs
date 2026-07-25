import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { buildTablaSustituciones, estadoDeSustitucion } = await import("../assets/academia/admin/js/sections/sustituciones/tablaSustituciones.js");

  const HOY = "2026-07-26";

  test("estadoDeSustitucion: revocada gana sobre cualquier fecha", () => {
    const estado = estadoDeSustitucion({ revocada_at: "2026-07-25T00:00:00Z", fecha_inicio: HOY, fecha_fin: HOY }, HOY);
    assert.deepEqual(estado, { texto: "Revocada", clase: "inactivo" });
  });

  test("estadoDeSustitucion: fecha_fin en el pasado -> Finalizada", () => {
    const estado = estadoDeSustitucion({ revocada_at: null, fecha_inicio: "2026-07-01", fecha_fin: "2026-07-02" }, HOY);
    assert.deepEqual(estado, { texto: "Finalizada", clase: "inactivo" });
  });

  test("estadoDeSustitucion: fecha_inicio en el futuro -> Futura", () => {
    const estado = estadoDeSustitucion({ revocada_at: null, fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05" }, HOY);
    assert.deepEqual(estado, { texto: "Futura", clase: "amber" });
  });

  test("estadoDeSustitucion: hoy dentro del rango, sin revocar -> Activa", () => {
    const estado = estadoDeSustitucion({ revocada_at: null, fecha_inicio: "2026-07-25", fecha_fin: "2026-07-27" }, HOY);
    assert.deepEqual(estado, { texto: "Activa", clase: "pagado" });
  });

  test("sin sustituciones muestra un mensaje vacío, no una tabla", () => {
    const wrap = buildTablaSustituciones([], { hoyISO: HOY, onRevocar: () => {} });
    assert.equal(wrap.querySelector("table"), null);
    assert.ok(wrap.textContent.includes("Todavía no hay ninguna sustitución"));
  });

  test("una fila activa tiene botón Revocar; una ya revocada no", () => {
    const activa = { id: "s1", sustituto_nombre: "Ana", sustituido_nombre: "Bea", fecha_inicio: HOY, fecha_fin: HOY, origen: "autodeclarada", declarada_por_nombre: "Ana", revocada_at: null };
    const revocada = { id: "s2", sustituto_nombre: "Carlos", sustituido_nombre: "Dani", fecha_inicio: "2026-06-01", fecha_fin: "2026-06-01", origen: "admin", declarada_por_nombre: "Admin", revocada_at: "2026-06-02T00:00:00Z" };
    const wrap = buildTablaSustituciones([activa, revocada], { hoyISO: HOY, onRevocar: () => {} });
    const filas = wrap.querySelectorAll("tbody tr");
    assert.equal(filas.length, 2);
    assert.ok(filas[0].querySelector("button"), "la activa sí puede revocarse");
    assert.equal(filas[1].querySelector("button"), null, "la ya revocada no necesita otro botón de revocar");
  });

  test("clic en Revocar llama a onRevocar con esa sustitución", () => {
    const activa = { id: "s1", sustituto_nombre: "Ana", sustituido_nombre: "Bea", fecha_inicio: HOY, fecha_fin: HOY, origen: "autodeclarada", declarada_por_nombre: "Ana", revocada_at: null };
    let recibido = null;
    const wrap = buildTablaSustituciones([activa], { hoyISO: HOY, onRevocar: (s) => { recibido = s; } });
    wrap.querySelector("button").dispatchEvent(new window.Event("click"));
    assert.equal(recibido.id, "s1");
  });

  test("el rango de fechas se muestra completo cuando abarca varios días, y compacto cuando es un solo día", () => {
    const unDia = { id: "s1", sustituto_nombre: "Ana", sustituido_nombre: "Bea", fecha_inicio: HOY, fecha_fin: HOY, origen: "admin", revocada_at: null };
    const variosDias = { id: "s2", sustituto_nombre: "Ana", sustituido_nombre: "Bea", fecha_inicio: "2026-07-20", fecha_fin: "2026-07-25", origen: "admin", revocada_at: null };
    const wrap = buildTablaSustituciones([unDia, variosDias], { hoyISO: HOY, onRevocar: () => {} });
    const celdasFecha = [...wrap.querySelectorAll("tbody tr")].map((tr) => tr.children[2].textContent);
    assert.equal(celdasFecha[0], HOY);
    assert.equal(celdasFecha[1], "2026-07-20 → 2026-07-25");
  });
}
