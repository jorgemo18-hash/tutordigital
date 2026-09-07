import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// La ficha guardada de un alumno que ya existe: se ve, y si no la tiene se
// puede subir. Es lo que pedía el caso real — "que se quede la vista previa
// y al pincharla se haga grande, para tener guardadas las fichas".
//
// DESDE LA MIGRACIÓN 114 EL PINTADO ES ASÍNCRONO. La ficha ya no es una URL
// pública que se pueda meter en un <img src>: vive en un bucket privado y hay
// que descargarla por una ruta que exige sesión. Por eso todos los tests
// esperan un tick antes de mirar el DOM.
export async function run({ test, assert }) {
  const { buildFichaBlock } = await import(
    "../../assets/academia/admin/js/drawer/ficha/fichaBlock.js"
  );

  const asentar = () => new Promise((r) => setTimeout(r, 0));

  // happy-dom no implementa createObjectURL: se sustituye por algo que
  // devuelva una cadena reconocible, que es lo único que necesita el <img>.
  window.URL.createObjectURL = (blob) => `blob:fake/${blob?.type || "?"}`;
  window.URL.revokeObjectURL = () => {};
  globalThis.URL.createObjectURL = window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;

  const blobDe = (type) => new window.Blob(["x"], { type });

  test("con ficha guardada se descarga y se enseña la imagen, no un botón de subir", async () => {
    const wrap = buildFichaBlock({
      tieneFicha: true,
      alumnoId: "a1",
      descargarFichaFn: async () => blobDe("image/jpeg"),
    });
    await asentar();

    const img = wrap.querySelector("img");
    assert.ok(img, "tiene que verse la ficha");
    assert.ok(img.getAttribute("src").startsWith("blob:"), "se pinta el archivo descargado, no una URL de Storage");
    assert.equal(wrap.querySelector("button"), null, "ya no hay nada que subir");
  });

  test("SEGURIDAD: se pide por el id del alumno, nunca por una URL de la fila", async () => {
    // Si esto volviera a pintar `ficha_url`, el <img> apuntaría otra vez a un
    // enlace público que abre la hoja firmada de un menor sin login.
    const pedidos = [];
    buildFichaBlock({
      tieneFicha: true,
      alumnoId: "alumno-7",
      descargarFichaFn: async (id) => { pedidos.push(id); return blobDe("image/jpeg"); },
    });
    await asentar();
    assert.deepEqual(pedidos, ["alumno-7"]);
  });

  test("la miniatura es clicable (para verla a tamaño completo)", async () => {
    const wrap = buildFichaBlock({
      tieneFicha: true, alumnoId: "a1", descargarFichaFn: async () => blobDe("image/jpeg"),
    });
    await asentar();
    assert.equal(wrap.querySelector("img").style.cursor, "pointer");
  });

  test("un PDF se enseña embebido, con enlace para abrirlo aparte", async () => {
    // El tipo se lee del BLOB: un object URL no tiene extensión y mirar la
    // URL diría que todo es una imagen.
    const wrap = buildFichaBlock({
      tieneFicha: true, alumnoId: "a1", descargarFichaFn: async () => blobDe("application/pdf"),
    });
    await asentar();
    assert.ok(wrap.querySelector("iframe"), "el PDF se previsualiza");
    assert.ok(wrap.querySelector("a[target='_blank']"), "y se puede abrir entero");
  });

  test("una ficha antigua sin migrar se sigue viendo por su URL vieja", async () => {
    // Entre aplicar la migración 114 y ejecutar el script que mueve los
    // archivos, el backend responde 404. Que la ficha desapareciera del panel
    // sería peor que enseñarla unos días más como estaba.
    const wrap = buildFichaBlock({
      alumnoId: "a1",
      fichaUrlLegado: "https://cdn.test/t/fichas/a1.jpg",
      descargarFichaFn: async () => null,
    });
    await asentar();
    assert.equal(wrap.querySelector("img").getAttribute("src"), "https://cdn.test/t/fichas/a1.jpg");
  });

  test("sin ficha: botón para subirla, contra el id del alumno", async () => {
    const subidas = [];
    const wrap = buildFichaBlock({
      alumnoId: "alumno-7",
      uploadFichaAlumnoFn: async (id, adj) => {
        subidas.push({ id, mime: adj.mime });
        return "t/fichas/alumno-7.jpg";
      },
      descargarFichaFn: async () => blobDe("image/jpeg"),
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

  test("lo que se devuelve al subir es una RUTA, y es lo que se propaga", async () => {
    let recibido = null;
    const wrap = buildFichaBlock({
      alumnoId: "a1",
      uploadFichaAlumnoFn: async () => "tenant-1/fichas/a1.jpg",
      descargarFichaFn: async () => blobDe("image/jpeg"),
      readFileAsBase64Fn: async () => "YmFzZTY0",
      onFichaSubida: (valor) => { recibido = valor; },
    });
    const input = wrap.querySelector('input[type="file"]');
    const file = new window.File(["hoja"], "ficha.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    await asentar();

    assert.equal(recibido, "tenant-1/fichas/a1.jpg");
    assert.equal(String(recibido).startsWith("http"), false, "una URL aquí sería el fallo que se acaba de arreglar");
  });

  test("un tipo no admitido no llega al servidor", async () => {
    let llamadas = 0;
    const wrap = buildFichaBlock({
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
