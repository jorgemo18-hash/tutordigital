import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { buildTablaProfesores } = await import("../assets/academia/admin/js/sections/profesores/tablaProfesores.js");

  test("sin profesores muestra un mensaje vacío, no una tabla", () => {
    const wrap = buildTablaProfesores([], { onRevocar: () => {}, onAbrir: () => {} });
    assert.equal(wrap.querySelector("table"), null);
    assert.ok(wrap.textContent.includes("Todavía no hay profesores"));
  });

  test("un profesor activo se pinta con badge 'Activo' y sin botón de revocar", () => {
    const profesor = { id: "p1", email: "activo@demo.com", display_name: "Activo Demo", is_active: true, invite: null };
    const wrap = buildTablaProfesores([profesor], { onRevocar: () => {}, onAbrir: () => {} });
    const badge = wrap.querySelector(".ac-estado-badge");
    assert.equal(badge.textContent, "Activo");
    assert.ok(badge.classList.contains("pagado"));
    assert.equal(wrap.querySelector("button"), null, "un profesor activo no tiene nada que revocar");
  });

  test("una invitación pendiente se pinta con badge 'Invitación pendiente' y botón Revocar", () => {
    const profesor = {
      id: null, email: "pendiente@demo.com", display_name: "Pendiente Demo", is_active: false,
      invite: { id: "inv1", status: "pending" },
    };
    const wrap = buildTablaProfesores([profesor], { onRevocar: () => {}, onAbrir: () => {} });
    const badge = wrap.querySelector(".ac-estado-badge");
    assert.equal(badge.textContent, "Invitación pendiente");
    assert.ok(badge.classList.contains("pendiente"));
    assert.ok(wrap.querySelector("button"), "una invitación pendiente sí debe poder revocarse");
  });

  test("clic en Revocar llama a onRevocar con ese profesor, no a onAbrir", () => {
    const profesor = {
      id: null, email: "pendiente@demo.com", display_name: "Pendiente Demo", is_active: false,
      invite: { id: "inv1", status: "pending" },
    };
    let recibido = null;
    let abrirLlamado = false;
    const wrap = buildTablaProfesores([profesor], {
      onRevocar: (p) => { recibido = p; },
      onAbrir: () => { abrirLlamado = true; },
    });
    wrap.querySelector("button").dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(recibido.email, "pendiente@demo.com");
    assert.equal(abrirLlamado, false, "el stopPropagation del botón no debe dejar pasar el clic a la fila");
  });

  test("un profesor inactivo (dado de baja, sin invitación pendiente) se pinta como 'Inactivo'", () => {
    const profesor = { id: "p2", email: "baja@demo.com", display_name: "De Baja", is_active: false, invite: null };
    const wrap = buildTablaProfesores([profesor], { onRevocar: () => {}, onAbrir: () => {} });
    const badge = wrap.querySelector(".ac-estado-badge");
    assert.equal(badge.textContent, "Inactivo");
    assert.ok(badge.classList.contains("inactivo"));
  });

  test("clic en la fila de un profesor con id llama a onAbrir con ese profesor", () => {
    const profesor = { id: "p1", email: "activo@demo.com", display_name: "Activo Demo", is_active: true, invite: null };
    let recibido = null;
    const wrap = buildTablaProfesores([profesor], { onRevocar: () => {}, onAbrir: (p) => { recibido = p; } });
    const fila = wrap.querySelector("tbody tr");
    assert.ok(fila.classList.contains("ac-fila-clicable"));
    fila.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(recibido.id, "p1");
  });

  test("una invitación pendiente (sin id) no es clicable — no tiene nada que editar todavía", () => {
    const profesor = {
      id: null, email: "pendiente@demo.com", display_name: "Pendiente Demo", is_active: false,
      invite: { id: "inv1", status: "pending" },
    };
    let abrirLlamado = false;
    const wrap = buildTablaProfesores([profesor], { onRevocar: () => {}, onAbrir: () => { abrirLlamado = true; } });
    const fila = wrap.querySelector("tbody tr");
    assert.equal(fila.classList.contains("ac-fila-clicable"), false);
    fila.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(abrirLlamado, false);
  });
}
