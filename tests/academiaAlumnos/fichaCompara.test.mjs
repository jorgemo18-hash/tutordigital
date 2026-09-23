import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// SUBIR LA FICHA DE UN ALUMNO QUE YA EXISTE.
//
// Jorge, 23/09/2026: *"he creado un alumno con datos falsos para que me
// salga ya en el horario porque ha empezado, pero no tengo la ficha, y
// cuando me la dan, al subirla no cambia lo que hay"*.
//
// Lo que se prueba aquí son las cuatro decisiones de este flujo, y las
// cuatro se pueden romper sin que nada dé error:
//
//   1. la foto se guarda ANTES de leerla, y un fallo del OCR no se lleva por
//      delante la subida;
//   2. un campo que la ficha no trae NO se trata como "la ficha dice vacío";
//   3. lo que estaba vacío viene marcado y lo que choca no;
//   4. no se pregunta nada cuando no hay nada que preguntar.
export async function run({ test, assert }) {
  const { comparaFicha, valoresAceptados, hayDiferencias, CAMPOS_ALUMNO, CAMPOS_FAMILIA } =
    await import("../../assets/academia/admin/js/drawer/ficha/comparaFicha.js");
  const { buildFichaBlock } = await import(
    "../../assets/academia/admin/js/drawer/ficha/fichaBlock.js"
  );

  const asentar = () => new Promise((r) => setTimeout(r, 0));

  // ── La comparación ────────────────────────────────────────────────────

  test("UN CAMPO QUE LA FICHA NO TRAE NO ES UNA DIFERENCIA", () => {
    // EL PUNTO MÁS PELIGROSO DE TODOS. El OCR omite las claves que no supo
    // leer (ver normalizarDatosOcr.js). Si "ausente" se tratara como "la
    // ficha dice vacío", aceptar los cambios borraría el teléfono bueno de
    // un alumno porque el reconocimiento no acertó a leer esa línea.
    const dif = comparaFicha(
      { nombre: "Lucía", telefono: "600111222", email: "l@x.com" },
      { nombre: "Lucía Ruiz" },
      CAMPOS_ALUMNO,
    );
    assert.deepEqual(dif.map((d) => d.campo), ["nombre"]);
  });

  test("y una cadena vacía tampoco", () => {
    const dif = comparaFicha({ telefono: "600111222" }, { telefono: "   " }, CAMPOS_ALUMNO);
    assert.deepEqual(dif, []);
  });

  test("LO QUE ESTABA VACÍO VIENE MARCADO; lo que choca, no", () => {
    // Rellenar un hueco no pierde nada. Pisar un dato bueno sí, y esa
    // decisión la tiene que tomar una persona mirando.
    const dif = comparaFicha(
      { nombre: "Alumno nuevo", telefono: null },
      { nombre: "Lucía Ruiz", telefono: "656432109" },
      CAMPOS_ALUMNO,
    );
    const porCampo = Object.fromEntries(dif.map((d) => [d.campo, d]));
    assert.equal(porCampo.telefono.estado, "hueco");
    assert.equal(porCampo.telefono.aceptado, true, "un hueco se rellena solo");
    assert.equal(porCampo.nombre.estado, "distinto");
    assert.equal(porCampo.nombre.aceptado, false, "pisar un dato bueno se pregunta");
  });

  test("los espacios y las mayúsculas no cuentan como cambio", () => {
    // Si contaran, la lista se llenaría de ruido; y con ruido el admin deja
    // de leerla y acepta todo a ciegas, que es lo que esto viene a evitar.
    assert.deepEqual(
      comparaFicha({ nombre: "Juan  Pérez" }, { nombre: "juan pérez" }, CAMPOS_ALUMNO),
      [],
    );
  });

  test("pero los acentos SÍ: 'Martin' y 'Martín' no son lo mismo", () => {
    // La hoja manuscrita manda sobre cómo se escribe el nombre de alguien.
    const dif = comparaFicha({ nombre: "Martin" }, { nombre: "Martín" }, CAMPOS_ALUMNO);
    assert.equal(dif.length, 1, "se ha perdido la tilde por el camino");
  });

  test("solo viajan los campos aceptados, y con el valor de la ficha", () => {
    const dif = comparaFicha(
      { nombre: "Falso", telefono: null, ciudad: "Huesca" },
      { nombre: "Lucía Ruiz", telefono: "656432109", ciudad: "Barbastro" },
      CAMPOS_ALUMNO,
    );
    // Solo el hueco viene marcado de serie.
    assert.deepEqual(valoresAceptados(dif), { telefono: "656432109" });
    // Y lo no aceptado NO viaja con su valor de antes: mandarlo pisaría lo
    // que el admin hubiera editado a mano mientras tanto.
    assert.equal("nombre" in valoresAceptados(dif), false);

    dif.forEach((d) => { d.aceptado = true; });
    assert.deepEqual(valoresAceptados(dif), {
      nombre: "Lucía Ruiz", telefono: "656432109", ciudad: "Barbastro",
    });
  });

  test("la familia se compara con sus propios campos, IBAN incluido", () => {
    const dif = comparaFicha(
      { nombre: "Familia Ruiz", codigo_sepa: null },
      { nombre: "Familia Ruiz", codigo_sepa: "ES9121000418450200051332", dni: "12345678Z" },
      CAMPOS_FAMILIA,
    );
    assert.deepEqual(dif.map((d) => d.campo).sort(), ["codigo_sepa", "dni"]);
  });

  test("hayDiferencias distingue el caso de no preguntar nada", () => {
    assert.equal(hayDiferencias([], []), false);
    assert.equal(hayDiferencias([{ campo: "x" }], []), true);
    assert.equal(hayDiferencias([], [{ campo: "x" }]), true);
  });

  // ── El flujo de subida ────────────────────────────────────────────────

  const montar = (opciones = {}) => {
    const llamadas = { subidas: 0, ocr: 0, dialogos: 0, aplicado: null };
    const wrap = buildFichaBlock({
      alumnoId: "al-1",
      tieneFicha: false,
      readFileAsBase64Fn: async () => "BASE64",
      uploadFichaAlumnoFn: async () => { llamadas.subidas += 1; return "ruta/nueva.jpg"; },
      descargarFichaFn: async () => { throw new Error("sin ficha"); },
      extraerInscripcionFn: async () => {
        llamadas.ocr += 1;
        if (opciones.ocrFalla) throw new Error("ocr_failed");
        return opciones.leido || { alumno: {}, familia: {} };
      },
      dialogoComparaFichaFn: async (dif) => {
        llamadas.dialogos += 1;
        return opciones.eligeNada ? null : {
          alumno: valoresAceptados(dif.alumno),
          familia: valoresAceptados(dif.familia),
        };
      },
      getDatosActuales: () => opciones.actuales || { alumno: {}, familia: {} },
      onDatosDeFicha: opciones.sinAplicador ? null : (v) => { llamadas.aplicado = v; },
    });
    return { wrap, llamadas };
  };

  async function subirFoto(wrap) {
    const input = wrap.querySelector("input[type=file]");
    Object.defineProperty(input, "files", {
      value: [{ type: "image/jpeg", name: "ficha.jpg" }], configurable: true,
    });
    input.dispatchEvent(new window.Event("change"));
    await asentar();
    await asentar();
    await asentar();
  }

  test("LA FOTO SE SUBE AUNQUE EL OCR FALLE", async () => {
    // El documento es lo que no se puede perder: es lo que hay que enseñar
    // si una familia discute lo que firmó. Por eso se sube ANTES de leer, y
    // un fallo del reconocimiento no deshace nada.
    const { wrap, llamadas } = montar({ ocrFalla: true });
    await subirFoto(wrap);
    assert.equal(llamadas.subidas, 1, "la foto no se ha guardado");
    assert.equal(llamadas.dialogos, 0, "no hay nada que preguntar si no se pudo leer");
  });

  test("SIN DIFERENCIAS NO SE PREGUNTA NADA", async () => {
    // Archivar la hoja firmada de un alumno cuyos datos ya estaban bien es
    // el caso normal: un diálogo de "no hay cambios" sería un clic de más
    // cada vez.
    const { wrap, llamadas } = montar({
      actuales: { alumno: { nombre: "Lucía Ruiz" }, familia: {} },
      leido: { alumno: { nombre: "Lucía Ruiz" }, familia: {} },
    });
    await subirFoto(wrap);
    assert.equal(llamadas.subidas, 1);
    assert.equal(llamadas.ocr, 1);
    assert.equal(llamadas.dialogos, 0);
  });

  test("con diferencias se pregunta, y lo elegido se aplica", async () => {
    const { wrap, llamadas } = montar({
      actuales: { alumno: { nombre: "Alumno nuevo", telefono: null }, familia: {} },
      leido: { alumno: { nombre: "Lucía Ruiz", telefono: "656432109" }, familia: {} },
    });
    await subirFoto(wrap);
    assert.equal(llamadas.dialogos, 1);
    // Solo el hueco, que es lo que viene marcado de serie.
    assert.deepEqual(llamadas.aplicado.alumno, { telefono: "656432109" });
  });

  test("cancelar la comparación NO deshace la subida", async () => {
    const { wrap, llamadas } = montar({
      eligeNada: true,
      actuales: { alumno: { nombre: "Falso" }, familia: {} },
      leido: { alumno: { nombre: "Lucía Ruiz" }, familia: {} },
    });
    await subirFoto(wrap);
    assert.equal(llamadas.subidas, 1, "la foto tiene que quedarse igual");
    assert.equal(llamadas.aplicado, null, "no se ha cambiado nada, como se pidió");
  });

  // ── El diálogo ────────────────────────────────────────────────────────

  test("\"USAR TODO LO DE LA FICHA\" DEVUELVE TODO, también lo no marcado", async () => {
    // El botón del caso de Jorge: el alumno se creó con datos inventados,
    // así que la ficha gana en todo. Si solo devolviera lo ya marcado, sería
    // el mismo botón que "usar solo lo marcado" y no serviría de nada.
    const { dialogoComparaFicha } = await import(
      "../../assets/academia/admin/js/drawer/ficha/dialogoComparaFicha.js"
    );
    const alumno = comparaFicha(
      { nombre: "Falso", curso: "1º ESO", ciudad: null },
      { nombre: "Lucía Ruiz", curso: "2º ESO", ciudad: "Barbastro" },
      CAMPOS_ALUMNO,
    );
    const promesa = dialogoComparaFicha({ alumno, familia: [] });
    const botones = [...document.querySelectorAll(".ac-modal-acciones button")];
    botones.find((b) => b.textContent.includes("Usar todo")).click();
    assert.deepEqual(await promesa, {
      alumno: { nombre: "Lucía Ruiz", curso: "2º ESO", ciudad: "Barbastro" },
      familia: {},
    });
    assert.equal(document.querySelector(".ac-modal-overlay"), null, "el diálogo se queda abierto");
  });

  test("\"No cambiar nada\" devuelve null, y Escape también", async () => {
    const { dialogoComparaFicha } = await import(
      "../../assets/academia/admin/js/drawer/ficha/dialogoComparaFicha.js"
    );
    const dif = () => comparaFicha({ nombre: "Falso" }, { nombre: "Lucía" }, CAMPOS_ALUMNO);

    const conBoton = dialogoComparaFicha({ alumno: dif(), familia: [] });
    [...document.querySelectorAll(".ac-modal-acciones button")]
      .find((b) => b.textContent.includes("No cambiar")).click();
    assert.equal(await conBoton, null);

    const conEscape = dialogoComparaFicha({ alumno: dif(), familia: [] });
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(await conEscape, null);
    assert.equal(document.querySelector(".ac-modal-overlay"), null);
  });

  test("el título y los botones NO están dentro de la parte que se desplaza", async () => {
    // Se vio en la captura: con el panel entero desplazable, el diálogo se
    // abría por la mitad —sin título ni primeras filas— porque enfocar el
    // botón arrastraba el desplazamiento, y con doce diferencias había que
    // bajar hasta el final para encontrar "Usar todo lo de la ficha".
    const { dialogoComparaFicha } = await import(
      "../../assets/academia/admin/js/drawer/ficha/dialogoComparaFicha.js"
    );
    const promesa = dialogoComparaFicha({
      alumno: comparaFicha({ nombre: "Falso" }, { nombre: "Lucía" }, CAMPOS_ALUMNO),
      familia: [],
    });
    const scroll = document.querySelector(".ac-ficha-dif-cuerpo-scroll");
    assert.ok(scroll, "no existe la parte desplazable");
    assert.equal(scroll.querySelector(".ac-modal-titulo"), null, "el título se desplazaría con la lista");
    assert.equal(scroll.querySelector(".ac-modal-acciones"), null, "los botones también");
    assert.ok(scroll.querySelector(".ac-ficha-dif"), "y las diferencias sí van dentro");

    const fs = await import("node:fs");
    const css = fs.readFileSync("assets/academia/admin/css/_academia-admin-secciones.css", "utf8");
    assert.ok(
      /\.ac-ficha-dif-cuerpo-scroll\s*\{[^}]*overflow-y:\s*auto/.test(css),
      "sin overflow en la lista, el panel entero vuelve a desplazarse",
    );
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    await promesa;
  });

  test("sin quien aplique los datos no se lee la ficha siquiera", async () => {
    // Enseñar una lista de cambios que después no se pueden hacer es peor
    // que no enseñarla.
    const { wrap, llamadas } = montar({
      sinAplicador: true,
      actuales: { alumno: { nombre: "Falso" }, familia: {} },
      leido: { alumno: { nombre: "Lucía Ruiz" }, familia: {} },
    });
    await subirFoto(wrap);
    assert.equal(llamadas.subidas, 1);
    assert.equal(llamadas.ocr, 0, "se ha gastado una llamada al OCR para nada");
  });
}
