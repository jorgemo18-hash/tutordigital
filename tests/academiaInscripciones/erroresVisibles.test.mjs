import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Subir la ficha de inscripción: que el error diga QUÉ ha pasado.
//
// El catch era `catch {}` sin la variable, así que tres cosas distintas
// —archivo de más de 5MB, DNG que el servidor no sabe convertir, y fallo
// real del OCR— mostraban el mismo "No se pudieron extraer los datos".
//
// Eso llevó a un diagnóstico equivocado en producción: parecía "el OCR no
// lee PNG ni DNG" cuando en realidad los rechazaba el LÍMITE DE TAMAÑO
// antes de mirar el formato. Un JPG de móvil pesa 2-4MB y pasa; un PNG de
// la misma hoja se va a 8-10MB y un DNG a 25MB. El servidor siempre
// distinguió los tres casos; era esta pantalla la que los aplanaba.
export async function run({ test, assert }) {
  const { buildInscripcionUpload } = await import(
    "../../assets/academia/admin/js/drawer/inscripcionUpload.js"
  );

  const asentar = () => new Promise((r) => setTimeout(r, 0));

  function ficheroFalso(nombre = "ficha.png", type = "image/png") {
    return new window.File(["x"], nombre, { type });
  }

  function montar(extraerInscripcionFn) {
    const extraidos = [];
    const wrap = buildInscripcionUpload({
      onExtraido: (datos) => extraidos.push(datos),
      extraerInscripcionFn,
      // Lo que se prueba es el FLUJO de errores, no leer el fichero.
      readFileAsBase64Fn: async () => "YmFzZTY0",
    });
    return { wrap, extraidos };
  }

  async function elegir(wrap, file) {
    const input = wrap.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    await asentar();
  }

  const errorCon = (code, message) => {
    const err = new Error(message);
    err.code = code;
    return err;
  };

  test("REGRESIÓN: un archivo demasiado grande ofrece convertirlo, no un error genérico", async () => {
    // La ayuda para convertir existía, pero solo estaba enganchada en el
    // flujo de gastos. Por eso al subir una ficha nunca aparecía.
    const { wrap } = montar(async () => { throw errorCon("file_too_large", "El archivo supera los 5MB."); });
    await elegir(wrap, ficheroFalso("ficha.dng", "image/x-adobe-dng"));

    const texto = wrap.textContent;
    assert.ok(/demasiado grande/i.test(texto), "dice que es de tamaño");
    assert.ok(/convi[eé]rtelo|convertir/i.test(texto), "y ofrece cómo arreglarlo");
    assert.equal(/No se pudieron extraer los datos/i.test(texto), false, "no el error genérico de OCR");
  });

  test("REGRESIÓN: un DNG que el servidor no puede convertir dice POR QUÉ", async () => {
    const { wrap } = montar(async () => {
      throw errorCon("conversion_failed", "El servidor no tiene soporte RAW para DNG.");
    });
    await elegir(wrap, ficheroFalso("ficha.dng", "image/x-adobe-dng"));
    assert.ok(wrap.textContent.includes("soporte RAW"), "se enseña el mensaje del servidor");
  });

  test("un fallo real del OCR sigue avisando, con su mensaje", async () => {
    const { wrap, extraidos } = montar(async () => {
      throw errorCon("ocr_failed", "No se pudieron extraer los datos");
    });
    await elegir(wrap, ficheroFalso());
    assert.ok(wrap.textContent.includes("No se pudieron extraer los datos"));
    assert.deepEqual(extraidos, []);
  });

  test("un error sin mensaje no deja la pantalla muda", async () => {
    const { wrap } = montar(async () => { throw new Error(""); });
    await elegir(wrap, ficheroFalso());
    assert.ok(wrap.textContent.trim().length > 0, "algo tiene que decir");
  });

  test("si va bien, se entregan los datos y no se enseña ninguna ayuda", async () => {
    const { wrap, extraidos } = montar(async () => ({ alumno: { nombre: "Marta" }, familia: {} }));
    await elegir(wrap, ficheroFalso("ficha.jpg", "image/jpeg"));
    assert.equal(extraidos.length, 1);
    assert.equal(extraidos[0].alumno.nombre, "Marta");
    assert.equal(/demasiado grande/i.test(wrap.textContent), false);
  });

  test("un tipo no admitido se rechaza antes de llamar al servidor", async () => {
    let llamadas = 0;
    const { wrap } = montar(async () => { llamadas++; return {}; });
    await elegir(wrap, ficheroFalso("hoja.xlsx", "application/vnd.ms-excel"));
    assert.equal(llamadas, 0);
    assert.ok(/Solo se aceptan/i.test(wrap.textContent));
  });

  test("la ayuda de un intento anterior no se queda pegada en el siguiente", async () => {
    let primera = true;
    const { wrap } = montar(async () => {
      if (primera) { primera = false; throw errorCon("file_too_large", "El archivo supera los 5MB."); }
      return { alumno: { nombre: "Marta" }, familia: {} };
    });
    await elegir(wrap, ficheroFalso("grande.png", "image/png"));
    assert.ok(/demasiado grande/i.test(wrap.textContent));

    await elegir(wrap, ficheroFalso("pequena.jpg", "image/jpeg"));
    assert.equal(/demasiado grande/i.test(wrap.textContent), false, "la ayuda vieja se limpia");
  });
}
