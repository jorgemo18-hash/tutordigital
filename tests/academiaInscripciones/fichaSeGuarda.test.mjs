import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// La foto de la ficha de inscripción se queda.
//
// Antes se usaba para leer los datos y se descartaba: el alumno quedaba dado
// de alta pero sin el documento firmado, que es justo lo que hay que poder
// enseñar si una familia discute lo que aceptó. Mismo patrón que la factura
// de un gasto: el archivo se guarda en memoria y se sube DESPUÉS de crear al
// alumno, contra su id real (nunca uno inventado, que es lo que dejaba
// huérfanos en Storage).
export async function run({ test, assert }) {
  const { buildInscripcionUpload } = await import(
    "../../assets/academia/admin/js/drawer/inscripcionUpload.js"
  );

  const asentar = () => new Promise((r) => setTimeout(r, 0));

  function ficheroFalso(nombre = "ficha.jpg", type = "image/jpeg") {
    return new window.File(["hoja-escaneada"], nombre, { type });
  }

  function montar(extraerInscripcionFn) {
    const extraidos = [];
    const ctl = buildInscripcionUpload({
      onExtraido: (datos) => extraidos.push(datos),
      extraerInscripcionFn: extraerInscripcionFn || (async () => ({ alumno: { nombre: "Alejandra" }, familia: {} })),
      readFileAsBase64Fn: async () => "YmFzZTY0",
    });
    return { ctl, extraidos };
  }

  async function elegir(ctl, file) {
    const input = ctl.wrap.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    await asentar();
  }

  test("antes de elegir nada no hay ficha que adjuntar", () => {
    assert.equal(montar().ctl.getArchivo(), null);
  });

  test("con OCR correcto: llegan los datos Y queda la ficha lista para subir", async () => {
    const { ctl, extraidos } = montar();
    await elegir(ctl, ficheroFalso());
    assert.equal(extraidos[0].alumno.nombre, "Alejandra");
    assert.ok(ctl.getArchivo(), "la foto ya no se tira después de leerla");
    assert.equal(ctl.getArchivo().mime, "image/jpeg");
    assert.equal(ctl.getArchivo().base64, "YmFzZTY0");
  });

  test("REGRESIÓN: si el OCR falla, la ficha NO se pierde", async () => {
    // La hoja firmada vale por sí sola. Tirarla porque el reconocimiento de
    // texto no acertó es perder lo importante por lo accesorio — y es
    // justo el caso en que el admin va a rellenar a mano mirándola.
    const { ctl, extraidos } = montar(async () => { throw new Error("OCR caído"); });
    await elegir(ctl, ficheroFalso());
    assert.deepEqual(extraidos, [], "no hay datos que rellenar");
    assert.ok(ctl.getArchivo(), "pero la foto sigue ahí");
  });

  test("un archivo demasiado grande no se queda como adjunto", async () => {
    // El flujo de conversión vuelve a llamar con la versión reducida, y esa
    // es la que hay que subir: la grande fallaría también al subirla.
    const err = new Error("El archivo supera los 5MB.");
    err.code = "file_too_large";
    const { ctl } = montar(async () => { throw err; });
    await elegir(ctl, ficheroFalso("ficha.png", "image/png"));
    assert.equal(ctl.getArchivo(), null);
  });

  test("un tipo no admitido no se guarda ni se manda al servidor", async () => {
    let llamadas = 0;
    const { ctl } = montar(async () => { llamadas++; return {}; });
    await elegir(ctl, ficheroFalso("hoja.xlsx", "application/vnd.ms-excel"));
    assert.equal(llamadas, 0);
    assert.equal(ctl.getArchivo(), null);
  });

  test("elegir una segunda ficha reemplaza a la primera", async () => {
    const { ctl } = montar();
    await elegir(ctl, ficheroFalso("una.jpg", "image/jpeg"));
    await elegir(ctl, ficheroFalso("dos.png", "image/png"));
    assert.equal(ctl.getArchivo().mime, "image/png");
  });

  test("el módulo no sube nada por su cuenta: el alumno todavía no existe", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../../assets/academia/admin/js/drawer/inscripcionUpload.js", import.meta.url),
      "utf8"
    );
    // Sin comentarios: el archivo EXPLICA en prosa por qué no sube aquí, y
    // un registro sobre el texto crudo saltaría por la propia explicación.
    const codigo = src.replace(/^\s*\/\/.*$/gm, "");
    assert.equal(/uploadFichaAlumno\s*\(/.test(codigo), false, "la subida es cosa del guardado, con el id real");
    assert.equal(/randomUUID/.test(codigo), false, "ni se inventa un id de alumno");
  });
}
