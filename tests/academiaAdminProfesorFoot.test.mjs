import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// El pie del drawer de profesor: hasta ahora solo tenía Cancelar y Guardar,
// así que no había forma de quitar a nadie de la plantilla — ni por error de
// alta ni porque se fuera del centro.
//
// Son DOS acciones distintas a propósito: dar de baja conserva el histórico
// (diario, fichajes, informes siguen diciendo quién los hizo) y eliminar es
// solo para una ficha creada por error.
export async function run({ test, assert }) {
  const { buildProfesorFoot } = await import(
    "../assets/academia/admin/js/drawer/profesor/profesorDrawerFoot.js"
  );

  const click = (el) => el.dispatchEvent(new window.Event("click"));
  const botones = (foot) => [...foot.querySelectorAll("button")].map((b) => b.textContent);
  const boton = (foot, texto) => [...foot.querySelectorAll("button")].find((b) => b.textContent === texto);

  const ACTIVO = { id: "p1", display_name: "María", is_active: true };
  const INACTIVO = { id: "p2", display_name: "Pedro", is_active: false };

  function montar(profesor, extra = {}) {
    const llamadas = [];
    const registrar = (nombre) => (btn) => llamadas.push({ nombre, btn });
    const params = {
      profesor,
      onCancelar: registrar("cancelar"),
      onGuardar: registrar("guardar"),
      onDarDeBaja: registrar("baja"),
      onReactivar: registrar("reactivar"),
      onEliminar: registrar("eliminar"),
      ...extra,
    };
    const contenedor = document.createElement("div");
    const foot = buildProfesorFoot(params);
    contenedor.appendChild(foot);
    return { contenedor, foot, llamadas };
  }

  test("un profesor activo tiene Dar de baja, y también Eliminar", () => {
    const { foot } = montar(ACTIVO);
    assert.ok(botones(foot).includes("Dar de baja"));
    assert.ok(botones(foot).includes("Eliminar de la plantilla"));
    assert.ok(botones(foot).includes("Guardar"));
  });

  test("uno ya dado de baja enseña Reactivar en vez de Dar de baja", () => {
    const { foot } = montar(INACTIVO);
    assert.ok(botones(foot).includes("Reactivar"));
    assert.equal(botones(foot).includes("Dar de baja"), false);
  });

  test("dar de baja PIDE confirmación, y dice que se conserva el histórico", () => {
    const { contenedor, foot, llamadas } = montar(ACTIVO);
    click(boton(foot, "Dar de baja"));
    assert.deepEqual(llamadas, [], "todavía no ha pasado nada");
    assert.ok(/¿Dar de baja a María\?/.test(contenedor.textContent));
    assert.ok(/hist[óo]rico/i.test(contenedor.textContent), "el admin tiene que saber que no pierde nada");

    click(boton(contenedor, "Sí, dar de baja"));
    assert.equal(llamadas[0].nombre, "baja");
  });

  test("reactivar es de un clic: es benigno", () => {
    // Mismo criterio que "Restaurar" en el drawer de alumno.
    const { foot, llamadas } = montar(INACTIVO);
    click(boton(foot, "Reactivar"));
    assert.equal(llamadas[0].nombre, "reactivar");
  });

  test("eliminar avisa de que es irreversible y de que es para un error", () => {
    const { contenedor, foot, llamadas } = montar(ACTIVO);
    click(boton(foot, "Eliminar de la plantilla"));
    assert.deepEqual(llamadas, []);
    assert.ok(/no se puede deshacer/i.test(contenedor.textContent));
    assert.ok(/error/i.test(contenedor.textContent), "y para qué sirve de verdad");

    click(boton(contenedor, "Sí, eliminar"));
    assert.equal(llamadas[0].nombre, "eliminar");
  });

  test("decir que NO devuelve el pie a como estaba, sin ejecutar nada", () => {
    const { contenedor, foot, llamadas } = montar(ACTIVO);
    click(boton(foot, "Eliminar de la plantilla"));
    click(boton(contenedor, "No"));
    assert.deepEqual(llamadas, []);
    assert.ok(boton(contenedor, "Eliminar de la plantilla"), "vuelven los botones normales");
    assert.ok(boton(contenedor, "Guardar"));
  });

  test("el botón se entrega al callback para poder deshabilitarlo", () => {
    // Sin la referencia, un doble clic mandaría dos peticiones.
    const { foot, llamadas } = montar(ACTIVO);
    click(boton(foot, "Guardar"));
    assert.ok(llamadas[0].btn, "el callback recibe su botón");
  });
}
