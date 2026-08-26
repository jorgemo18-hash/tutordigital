import { Window } from "happy-dom";

// No se pisa un window ya instalado por otro archivo de test: varios
// módulos de la suite comparten estos globals y todos se importan antes de
// que corra ningún test (ver rejillaCentro.test.mjs).
const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Lista de espera: matricular, editar y borrar con confirmación.
//
// La sección existía pero era un callejón sin salida: no convertía en
// alumno (que es para lo que sirve una lista de espera), no se editaba, y
// borraba con un solo clic y sin preguntar, con DELETE real.
export async function run({ test, assert }) {
  const { createListaEsperaSection } = await import(
    "../../assets/academia/admin/js/sections/listaEsperaSection.js"
  );

  const ENTRADA = {
    id: "e1", nombre: "Marta Pérez", curso: "3º ESO",
    telefono: "612345678", email: "marta@example.com", notas: "Prefiere tardes",
  };

  // `entradas` se lee en cada fetch para poder simular que el servidor ya
  // no la tiene tras un borrado.
  function montar({ entradas = [ENTRADA], onMatricular, confirmFn = () => true } = {}) {
    const llamadas = { crear: [], actualizar: [], eliminar: [], confirm: [] };
    let restantes = [...entradas];
    const section = createListaEsperaSection({
      fetchListaEsperaFn: async () => [...restantes],
      crearEntradaFn: async (datos) => { llamadas.crear.push(datos); },
      actualizarEntradaFn: async (id, cambios) => { llamadas.actualizar.push({ id, cambios }); },
      eliminarEntradaFn: async (id) => {
        llamadas.eliminar.push(id);
        restantes = restantes.filter((e) => e.id !== id);
      },
      confirmFn: (mensaje) => { llamadas.confirm.push(mensaje); return confirmFn(mensaje); },
      onMatricular,
    });
    const container = document.createElement("div");
    section.render(container);
    return { container, llamadas };
  }

  // render() dispara cargarTabla() sin await: se cede el turno para que la
  // promesa del fetch falso resuelva antes de mirar el DOM.
  const asentar = () => new Promise((r) => setTimeout(r, 0));

  function fila(container) {
    return container.querySelector("tbody tr");
  }

  test("pinta el email en su propia columna, no mezclado con el teléfono", async () => {
    const { container } = montar();
    await asentar();
    const celdas = [...fila(container).querySelectorAll("td")].map((td) => td.textContent);
    assert.equal(celdas[2], "612345678");
    assert.equal(celdas[3], "marta@example.com");
  });

  test("REGRESIÓN: eliminar pregunta antes, y si dices que no, no borra", async () => {
    // Era un DELETE real con un solo clic: un roce en el icono equivocado
    // borraba el contacto sin forma de recuperarlo.
    const { container, llamadas } = montar({ confirmFn: () => false });
    await asentar();
    fila(container).querySelector('[aria-label="Eliminar"]').click();
    await asentar();
    assert.equal(llamadas.confirm.length, 1, "ha preguntado");
    assert.ok(llamadas.confirm[0].includes("Marta Pérez"), "y dice a quién");
    assert.deepEqual(llamadas.eliminar, [], "no ha borrado nada");
  });

  test("si confirmas, sí borra", async () => {
    const { container, llamadas } = montar({ confirmFn: () => true });
    await asentar();
    fila(container).querySelector('[aria-label="Eliminar"]').click();
    await asentar();
    assert.deepEqual(llamadas.eliminar, ["e1"]);
  });

  test("editar en línea manda SOLO lo que ha cambiado", async () => {
    const { container, llamadas } = montar();
    await asentar();
    fila(container).querySelector('[aria-label="Editar"]').click();
    const inputs = fila(container).querySelectorAll("input, select");
    const telefono = [...inputs].find((i) => i.value === "612345678");
    telefono.value = "699999999";
    fila(container).querySelector('[aria-label="Guardar"]').click();
    await asentar();
    assert.equal(llamadas.actualizar.length, 1);
    assert.deepEqual(llamadas.actualizar[0], { id: "e1", cambios: { telefono: "699999999" } });
  });

  test("cancelar la edición no manda nada", async () => {
    const { container, llamadas } = montar();
    await asentar();
    fila(container).querySelector('[aria-label="Editar"]').click();
    fila(container).querySelector('[aria-label="Cancelar"]').click();
    await asentar();
    assert.deepEqual(llamadas.actualizar, []);
    assert.ok(fila(container).textContent.includes("Marta Pérez"), "vuelve a modo lectura");
  });

  test("guardar sin tocar nada cierra la fila sin llamar al servidor", async () => {
    const { container, llamadas } = montar();
    await asentar();
    fila(container).querySelector('[aria-label="Editar"]').click();
    fila(container).querySelector('[aria-label="Guardar"]').click();
    await asentar();
    assert.deepEqual(llamadas.actualizar, [], "nada que guardar, ninguna petición");
  });

  test("matricular pasa los datos del contacto a la ficha del alumno", async () => {
    let recibido = null;
    const { container } = montar({ onMatricular: async (e) => { recibido = e; return false; } });
    await asentar();
    fila(container).querySelector('[aria-label="Matricular como alumno"]').click();
    await asentar();
    assert.equal(recibido.nombre, "Marta Pérez");
    assert.equal(recibido.email, "marta@example.com");
  });

  test("REGRESIÓN: si el alta se cancela, el contacto NO se borra", async () => {
    // El orden importa: crear primero y borrar después. Si se borrara al
    // abrir la ficha, cerrarla a medias perdería el contacto para siempre.
    const { container, llamadas } = montar({ onMatricular: async () => false });
    await asentar();
    fila(container).querySelector('[aria-label="Matricular como alumno"]').click();
    await asentar();
    assert.deepEqual(llamadas.eliminar, [], "sigue en la lista");
    assert.deepEqual(llamadas.confirm, [], "y no ha preguntado nada");
  });

  test("si el alumno se crea de verdad, el contacto sale de la lista sin preguntar", async () => {
    const { container, llamadas } = montar({ onMatricular: async () => true });
    await asentar();
    fila(container).querySelector('[aria-label="Matricular como alumno"]').click();
    await asentar();
    assert.deepEqual(llamadas.eliminar, ["e1"]);
    assert.deepEqual(llamadas.confirm, [], "ya matriculado: confirmar sería ruido");
    assert.ok(container.querySelector(".ac-empty"), "la lista queda vacía");
  });

  test("si el alumno se crea pero el borrado falla, se avisa en vez de callar", async () => {
    const section = createListaEsperaSection({
      fetchListaEsperaFn: async () => [ENTRADA],
      eliminarEntradaFn: async () => { throw new Error("red caída"); },
      onMatricular: async () => true,
    });
    const container = document.createElement("div");
    section.render(container);
    await asentar();
    fila(container).querySelector('[aria-label="Matricular como alumno"]').click();
    await asentar();
    const msg = container.querySelector(".ac-drawer-msg.error");
    assert.ok(msg, "hay un aviso");
    assert.ok(msg.textContent.includes("sigue en la lista de espera"));
  });

  test("el alta manda el email como campo propio", async () => {
    const { container, llamadas } = montar({ entradas: [] });
    await asentar();
    const inputs = [...container.querySelectorAll(".ac-panel input")];
    const nombre = inputs.find((i) => i.placeholder === "Nombre");
    const email = inputs.find((i) => i.placeholder.startsWith("Email"));
    nombre.value = "Nuevo Contacto";
    email.value = "nuevo@example.com";
    [...container.querySelectorAll("button")].find((b) => b.textContent.includes("Añadir")).click();
    await asentar();
    assert.equal(llamadas.crear.length, 1);
    assert.equal(llamadas.crear[0].email, "nuevo@example.com");
    assert.equal(llamadas.crear[0].nombre, "Nuevo Contacto");
  });
}
