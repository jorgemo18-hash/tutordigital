import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// La ficha guardada de un alumno que ya existe: se ve, y si no la tiene se
// puede subir. Es lo que pedía el caso real — "que se quede la vista previa
// y al pincharla se haga grande, para tener guardadas las fichas".
export async function run({ test, assert }) {
  const { buildFichaBlock } = await import(
    "../../assets/academia/admin/js/drawer/ficha/fichaBlock.js"
  );

  const asentar = () => new Promise((r) => setTimeout(r, 0));

  test("con ficha guardada se enseña la imagen, no un botón de subir", async () => {
    const wrap = buildFichaBlock({ fichaUrl: "https://cdn.test/t/fichas/a1.jpg", alumnoId: "a1" });
    const img = wrap.querySelector("img");
    assert.ok(img, "tiene que verse la ficha");
    assert.equal(img.getAttribute("src"), "https://cdn.test/t/fichas/a1.jpg");
    assert.equal(wrap.querySelector("button"), null, "ya no hay nada que subir");
  });

  test("la miniatura es clicable (para verla a tamaño completo)", () => {
    const wrap = buildFichaBlock({ fichaUrl: "https://cdn.test/t/fichas/a1.jpg", alumnoId: "a1" });
    assert.equal(wrap.querySelector("img").style.cursor, "pointer");
  });

  test("un PDF se enseña embebido, con enlace para abrirlo aparte", () => {
    const wrap = buildFichaBlock({ fichaUrl: "https://cdn.test/t/fichas/a1.pdf", alumnoId: "a1" });
    assert.ok(wrap.querySelector("iframe"), "el PDF se previsualiza");
    assert.ok(wrap.querySelector("a[target='_blank']"), "y se puede abrir entero");
  });

  test("sin ficha: botón para subirla, contra el id del alumno", async () => {
    const subidas = [];
    const wrap = buildFichaBlock({
      fichaUrl: null,
      alumnoId: "alumno-7",
      uploadFichaAlumnoFn: async (id, adj) => {
        subidas.push({ id, mime: adj.mime });
        return "https://cdn.test/t/fichas/alumno-7.jpg";
      },
      readFileAsBase64Fn: async () => "YmFzZTY0",
    });
    assert.ok(wrap.querySelector("button"), "hay botón de subida");

    const input = wrap.querySelector('input[type="file"]');
    const file = new window.File(["hoja"], "ficha.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    await asentar();

    assert.deepEqual(subidas, [{ id: "alumno-7", mime: "image/jpeg" }]);
    assert.ok(wrap.querySelector("img"), "y al terminar ya se ve la ficha");
  });

  test("un tipo no admitido no llega al servidor", async () => {
    let llamadas = 0;
    const wrap = buildFichaBlock({
      fichaUrl: null,
      alumnoId: "a1",
      uploadFichaAlumnoFn: async () => { llamadas++; return ""; },
      readFileAsBase64Fn: async () => "YmFzZTY0",
    });
    const input = wrap.querySelector('input[type="file"]');
    const file = new window.File(["x"], "hoja.xlsx", { type: "application/vnd.ms-excel" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    assert.equal(llamadas, 0);
  });

  test("un fallo de subida se enseña con SU mensaje, no con uno genérico", async () => {
    const wrap = buildFichaBlock({
      fichaUrl: null,
      alumnoId: "a1",
      uploadFichaAlumnoFn: async () => { throw new Error("El archivo supera los 30MB permitidos."); },
      readFileAsBase64Fn: async () => "YmFzZTY0",
    });
    const input = wrap.querySelector('input[type="file"]');
    const file = new window.File(["x"], "ficha.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    await asentar();
    assert.ok(wrap.textContent.includes("30MB"), "el admin tiene que saber qué ha pasado");
  });
}
