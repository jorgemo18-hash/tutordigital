import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// La foto de la factura al CREAR un gasto.
//
// Estaba rota de una forma silenciosa: el archivo se subía nada más
// elegirlo, con un id inventado (crypto.randomUUID()), y la URL resultante
// se guardaba en el objeto del OCR. Pero rellenarDesdeOcr/leerValores no
// miraban `foto_url`, así que nunca llegaba al POST de creación. Resultado:
// gasto sin foto y archivo huérfano en Storage bajo un id que no
// corresponde a ningún gasto — el endpoint hace UPDATE ... WHERE id =
// <inventado>, que no afecta a ninguna fila y NO da error, así que ni
// siquiera se notaba.
//
// El arreglo es de orden: el archivo se guarda en memoria y se sube DESPUÉS
// de crear el gasto, contra su id real y por el mismo endpoint que ya usa la
// edición.
export async function run({ test, assert }) {
  const { buildGastoUpload } = await import(
    "../../assets/academia/admin/js/sections/finanzas/gastoUpload.js"
  );

  const asentar = () => new Promise((r) => setTimeout(r, 0));

  // El botón dispara un <input type=file>; aquí se llama directo al manejador
  // a través de un File sintético, que es lo que el navegador entregaría.
  function ficheroFalso(nombre = "factura.jpg", type = "image/jpeg") {
    return new window.File(["contenido-binario"], nombre, { type });
  }

  function montar({ extraerGastoFn } = {}) {
    const extraidos = [];
    const ctl = buildGastoUpload({
      onExtraido: (datos) => extraidos.push(datos),
      extraerGastoFn: extraerGastoFn || (async () => ({ proveedor: "Papelería", total_a_pagar: 12.5 })),
      // FileReader no se comporta igual fuera del navegador; lo que se
      // prueba aquí es el FLUJO, no la lectura del fichero.
      readFileAsBase64Fn: async () => "YmFzZTY0",
    });
    return { ctl, extraidos };
  }

  // El input real está dentro de buildGastoUploadButtons; se busca por tipo.
  async function elegir(ctl, file) {
    const input = ctl.wrap.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    await asentar();
  }

  test("antes de elegir nada, no hay archivo que adjuntar", () => {
    const { ctl } = montar();
    assert.equal(ctl.getArchivo(), null);
  });

  test("REGRESIÓN: el módulo ya NO sube nada por su cuenta", async () => {
    // Subir antes de que el gasto exista es lo que dejaba huérfanos en
    // Storage. Se comprueba sobre el propio archivo para que no vuelva a
    // colarse una llamada de subida aquí dentro.
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../../assets/academia/admin/js/sections/finanzas/gastoUpload.js", import.meta.url),
      "utf8"
    );
    // Se quitan los comentarios antes de mirar: el archivo EXPLICA en prosa
    // lo que hacía mal, y un registro sobre el texto crudo saltaría por la
    // propia explicación. El test tiene que hablar del código.
    const codigo = src.replace(/^\s*\/\/.*$/gm, "");
    assert.equal(/uploadFotoGasto\s*\(/.test(codigo), false, "no debe subir nada");
    assert.equal(/randomUUID/.test(codigo), false, "ni inventar un id de gasto");
  });

  test("con OCR correcto: se entregan los datos Y queda el archivo listo", async () => {
    const { ctl, extraidos } = montar();
    await elegir(ctl, ficheroFalso());
    assert.equal(extraidos.length, 1);
    assert.equal(extraidos[0].proveedor, "Papelería");
    assert.ok(ctl.getArchivo(), "el archivo se guarda para subirlo tras crear el gasto");
    assert.equal(ctl.getArchivo().mime, "image/jpeg");
  });

  test("REGRESIÓN: si el OCR falla, el archivo NO se pierde", async () => {
    // La foto de la factura vale por sí sola como justificante. Tirarla
    // porque el reconocimiento de texto no acertó es perder lo importante
    // por lo accesorio — y antes, además, no se subía nada en ese caso.
    const { ctl, extraidos } = montar({ extraerGastoFn: async () => { throw new Error("OCR caído"); } });
    await elegir(ctl, ficheroFalso());
    assert.deepEqual(extraidos, [], "no hay datos que rellenar");
    assert.ok(ctl.getArchivo(), "pero el archivo sigue ahí");
  });

  test("un archivo demasiado grande NO se queda como adjunto", async () => {
    // El flujo de conversión vuelve a llamar con la versión reducida, y esa
    // es la que hay que adjuntar. Guardar la grande fallaría también al subir.
    const grande = new Error("demasiado grande");
    grande.code = "file_too_large";
    const { ctl } = montar({ extraerGastoFn: async () => { throw grande; } });
    await elegir(ctl, ficheroFalso());
    assert.equal(ctl.getArchivo(), null);
  });

  test("un tipo no admitido no se acepta ni se guarda", async () => {
    const { ctl, extraidos } = montar();
    await elegir(ctl, ficheroFalso("hoja.xlsx", "application/vnd.ms-excel"));
    assert.equal(ctl.getArchivo(), null);
    assert.deepEqual(extraidos, []);
  });

  test("elegir un segundo archivo reemplaza al primero", async () => {
    const { ctl } = montar();
    await elegir(ctl, ficheroFalso("uno.jpg", "image/jpeg"));
    await elegir(ctl, ficheroFalso("dos.pdf", "application/pdf"));
    assert.equal(ctl.getArchivo().mime, "application/pdf");
  });
}
