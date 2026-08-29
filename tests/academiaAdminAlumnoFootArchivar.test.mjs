import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// REGRESIÓN: el "No" de "¿Archivar a X?" no cancelaba nada.
//
// El pie se sustituye por la confirmación, así que el nodo original queda
// SIN PADRE. El "No" llamaba a foot.replaceWith(...) sobre ese nodo ya
// desconectado, y replaceWith sin padre es un no-op silencioso: la
// confirmación se quedaba pegada y la única salida era cerrar el drawer —
// con el riesgo de acabar dándole a "Sí, archivar" por inercia.
export async function run({ test, assert }) {
  const { buildFootEditar } = await import(
    "../assets/academia/admin/js/drawer/alumnoDrawerFoot.js"
  );

  const click = (el) => el.dispatchEvent(new window.Event("click"));
  const boton = (raiz, texto) => [...raiz.querySelectorAll("button")].find((b) => b.textContent === texto);

  function montar() {
    const acciones = [];
    const contenedor = document.createElement("div");
    const msgEl = document.createElement("div");
    contenedor.appendChild(buildFootEditar(msgEl, {
      alumnoActual: { id: "a1", nombre: "Marta", activo: true },
      onCancelar: () => acciones.push("cancelar"),
      onGuardar: () => acciones.push("guardar"),
      onArchivar: () => acciones.push("archivar"),
      onRestaurar: () => acciones.push("restaurar"),
      onEliminarDefinitivo: () => acciones.push("eliminar"),
    }));
    return { contenedor, acciones };
  }

  test("archivar pide confirmación con el nombre del alumno", () => {
    const { contenedor, acciones } = montar();
    click(boton(contenedor, "Archivar"));
    assert.ok(/¿Archivar a Marta\?/.test(contenedor.textContent));
    assert.deepEqual(acciones, [], "todavía no se ha archivado nada");
  });

  test("REGRESIÓN: el 'No' devuelve el pie normal y no archiva", () => {
    const { contenedor, acciones } = montar();
    click(boton(contenedor, "Archivar"));
    click(boton(contenedor, "No"));
    assert.deepEqual(acciones, [], "no se archiva");
    assert.equal(/¿Archivar a Marta\?/.test(contenedor.textContent), false, "la confirmación desaparece");
    assert.ok(boton(contenedor, "Archivar"), "vuelven los botones de siempre");
    assert.ok(boton(contenedor, "Guardar"));
  });

  test("el 'Sí' sí archiva", () => {
    const { contenedor, acciones } = montar();
    click(boton(contenedor, "Archivar"));
    click(boton(contenedor, "Sí, archivar"));
    assert.deepEqual(acciones, ["archivar"]);
  });
}
