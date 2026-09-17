import { Window } from "happy-dom";

// El `|| new Window()` no es adorno: crear una ventana nueva aquí se la
// quita a los demás archivos de la suite que ya habían puesto la suya.
const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// EL VIAJE COMPLETO DE UN CAMPO DE AJUSTES: pantalla -> validación -> vuelta.
//
// El fallo del `reply_to` que no llegaba a Resend (17/09/2026) enseñó algo
// que aquí se repite tal cual: **una clave de más en un objeto no es un
// error para nadie**. `UpdateConfigSchema` es un `z.object`, así que una
// columna que se manda desde el panel pero no está declarada en el esquema
// se DESCARTA en silencio: status 200, "✓ Guardado" en pantalla, y el dato
// no llegó a la base de datos. Y si está en el esquema pero falta en
// `CONFIG_COLUMNS`, se guarda pero no vuelve: el admin recarga, ve el campo
// en blanco y lo vuelve a escribir.
//
// Así que este test no se para en el panel ni en el esquema: recorre los
// tres tramos con los campos REALES que pinta centroTab, para que el día
// que se añada el cuarto nombre o el quinto teléfono no haga falta acordarse
// de tocar los tres sitios — falla y te lo dice.
export async function run({ test, assert }) {
  const { buildCentroTab } = await import(
    "../../assets/academia/admin/js/sections/ajustes/tabs/centroTab.js"
  );
  const { UpdateConfigSchema, CONFIG_COLUMNS } = await import(
    "../../server/routes/v1/academia.config.routes.js"
  );

  const COLUMNAS = CONFIG_COLUMNS.split(",").map((c) => c.trim());

  // Monta la pestaña, escribe lo que se le diga y pulsa el Guardar DEL
  // PRIMER PANEL (el de identidad; el segundo es el del acceso al tutor,
  // que tiene su propio botón a propósito).
  async function guardarDesdeElPanel(config, escribir = () => {}) {
    const enviados = [];
    const wrap = buildCentroTab({
      fetchConfigFn: async () => config,
      updateConfigFn: async (payload) => { enviados.push(payload); return {}; },
    });
    await esperar(20);
    const panel = wrap.querySelectorAll(".ac-panel")[0];
    const porEtiqueta = {};
    for (const campo of panel.querySelectorAll(".ac-field")) {
      porEtiqueta[campo.querySelector(".ac-field-label").textContent] = campo.querySelector("input");
    }
    escribir(porEtiqueta);
    [...panel.querySelectorAll("button")].find((b) => b.textContent === "Guardar").click();
    await esperar(20);
    return { payload: enviados[0] || null, campos: porEtiqueta, panel };
  }

  test("el panel pinta los dos nombres como campos separados", async () => {
    const { campos } = await guardarDesdeElPanel({
      nombre_emisor: "ACADEMIA RUIZ, S.L.",
      nombre_comercial: "Academia Ruiz",
    });
    assert.equal(campos["Nombre / Razón social"]?.value, "ACADEMIA RUIZ, S.L.");
    assert.equal(campos["Nombre comercial (opcional)"]?.value, "Academia Ruiz");
  });

  test("cada nombre lleva su ayuda: sin ella nadie adivina por qué se pide dos veces", async () => {
    const { panel } = await guardarDesdeElPanel({});
    const ayudas = [...panel.querySelectorAll(".ac-field-hint")].map((n) => n.textContent);
    assert.ok(
      ayudas.some((t) => t.includes("Hacienda")),
      "la razón social tiene que decir que es el dato fiscal"
    );
    assert.ok(
      ayudas.some((t) => t.includes("bandeja de entrada")),
      "el comercial tiene que decir dónde se ve"
    );
  });

  test("EL PUNTO DE TODO: el nombre comercial sobrevive al esquema del PUT", async () => {
    const { payload } = await guardarDesdeElPanel({}, (campos) => {
      campos["Nombre comercial (opcional)"].value = "Academia Ruiz";
    });
    assert.equal(payload?.nombre_comercial, "Academia Ruiz", "el panel lo manda");

    const parsed = UpdateConfigSchema.safeParse(payload);
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
    assert.equal(
      parsed.data.nombre_comercial, "Academia Ruiz",
      "si esto viene undefined, el panel dice '✓ Guardado' y el dato no se guarda"
    );
  });

  test("y vuelve al panel: está en las columnas que se leen de la tabla", () => {
    assert.ok(
      COLUMNAS.includes("nombre_comercial"),
      "si falta, se guarda pero al recargar el campo aparece en blanco"
    );
  });

  // El barrido: lo que el panel manda y lo que el backend acepta y devuelve
  // tienen que cuadrar CAMPO A CAMPO. Es lo que hace que este test siga
  // sirviendo cuando el campo nuevo lo añada otro dentro de un año.
  test("ningún campo del panel se pierde por el camino (ni esquema ni SELECT)", async () => {
    const { payload } = await guardarDesdeElPanel({});
    const claves = Object.keys(payload || {});
    assert.ok(claves.length >= 7, `el panel manda pocos campos: ${claves.join(", ")}`);

    const parsed = UpdateConfigSchema.safeParse(payload);
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));

    const descartados = claves.filter((k) => !(k in parsed.data));
    assert.deepEqual(descartados, [], `el esquema descarta en silencio: ${descartados.join(", ")}`);

    const invisibles = claves.filter((k) => !COLUMNAS.includes(k));
    assert.deepEqual(invisibles, [], `se guardan pero no vuelven al panel: ${invisibles.join(", ")}`);
  });

  test("dejar el comercial en blanco es válido: significa 'usa el fiscal'", async () => {
    const { payload } = await guardarDesdeElPanel({ nombre_emisor: "Lyceo academia" });
    assert.equal(payload.nombre_comercial, "");
    const parsed = UpdateConfigSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.nombre_comercial, "", "el vacío tiene que llegar, para poder borrarlo");
  });
}
