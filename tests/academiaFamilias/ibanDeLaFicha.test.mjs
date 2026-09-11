import fs from "node:fs";

// El IBAN de la ficha de inscripción: se lee, pero solo se guarda si cuadra.
//
// ANTES (hasta el 11/09/2026) el IBAN era el ÚNICO dato de la hoja que no se
// leía. No por decisión —no hay ni un comentario ni una nota que lo diga—
// sino porque se quedó fuera al reescribir el prompt por bloques, y había
// además una segunda red que lo habría tirado igualmente: el normalizador
// construye el objeto `familia` con una lista fija de claves y `codigo_sepa`
// no estaba en ella. Así que el admin copiaba 24 caracteres a mano por cada
// domiciliación, y cuatro de los 22 que copió estaban mal.
//
// Y el argumento de privacidad para no leerlo no se sostiene: la foto entera
// de la ficha, con el IBAN dentro, ya viaja al modelo. No pedirlo no
// protegía nada.
//
// LO QUE LO HACE SEGURO no es el prompt, es el filtro de después: un IBAN
// que no pasa su dígito de control se descarta y el campo queda vacío. Es el
// único campo que se tira cuando no cuadra, y por una razón concreta: un
// nombre mal leído se ve de un vistazo; un IBAN mal leído no lo ve nadie
// hasta que el banco devuelve el cargo. Un hueco es honesto; un IBAN
// plausible y falso, no.
const ES_VALIDO = "ES9121000418450200051332";  // ejemplo de la especificación

export async function run({ test, assert }) {
  const { normalizarDatosInscripcion, ibanDeOcr } = await import(
    "../../server/lib/academiaInscripciones/normalizarDatosOcr.js"
  );

  const prompt = fs.readFileSync(
    new URL("../../server/lib/academiaAlumnoOcr.js", import.meta.url), "utf8"
  );

  test("el prompt pide el IBAN", () => {
    assert.match(prompt, /"iban":\s*""/, "si no está en el JSON que se pide, el modelo no lo devuelve");
  });

  test("y le dice que ante la duda lo deje vacío", () => {
    // Es la instrucción que importa: un IBAN inventado a medias es peor que
    // ninguno. La red de después lo filtra, pero conviene no provocarlo.
    assert.match(prompt, /devuelve ""/i);
    assert.match(prompt, /24 caracteres/);
  });

  test("un IBAN válido de la ficha llega a la familia", () => {
    const { familia } = normalizarDatosInscripcion({
      alumno: { nombre: "Alumno" },
      familia: { nombre_tutor: "Tutora", iban: ES_VALIDO },
      metodo_pago: "sepa",
    });
    assert.equal(familia.codigo_sepa, ES_VALIDO);
    assert.equal(familia.metodo_pago, "domiciliado", "y el método de pago se traduce, como ya hacía");
  });

  test("normalizado: los espacios del papel no llegan a la base de datos", () => {
    const { familia } = normalizarDatosInscripcion({
      familia: { nombre_tutor: "T", iban: "ES91 2100 0418 4502 0005 1332" },
    });
    assert.equal(familia.codigo_sepa, ES_VALIDO);
  });

  test("REGRESIÓN: un IBAN mal leído NO se guarda — el campo queda vacío", () => {
    for (const malo of [
      ES_VALIDO.slice(0, -1) + "3",   // un carácter cambiado
      ES_VALIDO.slice(0, 22),         // faltan dos
      "ES91 2100 0418 45",            // recortado
      "no se lee",
    ]) {
      const { familia } = normalizarDatosInscripcion({
        familia: { nombre_tutor: "Tutora", iban: malo },
      });
      assert.equal(
        familia.codigo_sepa, undefined,
        `se ha colado un IBAN que no valida: ${malo}`
      );
    }
  });

  test("el resto de los datos sigue llegando aunque el IBAN se caiga", () => {
    // Un IBAN ilegible no puede estropear el alta entera: es lo único que
    // se pierde, y se escribe a mano.
    const { alumno, familia } = normalizarDatosInscripcion({
      alumno: { nombre: "Ixeya Maestre", curso: "1º ESO" },
      familia: { nombre_tutor: "Ana", apellidos: "Gallego Torralba", dni: "12345678Z", iban: "ilegible" },
      metodo_pago: "sepa",
    });
    assert.equal(alumno.nombre, "Ixeya Maestre");
    assert.equal(familia.nombre, "Ana Gallego Torralba");
    assert.equal(familia.dni, "12345678Z");
    assert.equal(familia.codigo_sepa, undefined);
  });

  test("ibanDeOcr devuelve cadena vacía, no null ni undefined", () => {
    // soloConValor() decide por igualdad con "": si esto devolviera null, la
    // clave viajaría como null y pisaría el IBAN que el admin ya tuviera
    // escrito.
    assert.equal(ibanDeOcr("basura"), "");
    assert.equal(ibanDeOcr(undefined), "");
    assert.equal(ibanDeOcr(ES_VALIDO), ES_VALIDO);
  });

  // ── La misma comprobación en el backend, que es el que manda ──────────

  test("REGRESIÓN: los esquemas rechazan un IBAN que no valida", async () => {
    const { FamiliaNuevaSchema } = await import("../../server/lib/academiaAlumnoSchemas.js");
    const malo = FamiliaNuevaSchema.safeParse({ nombre: "X", codigo_sepa: ES_VALIDO.slice(0, 22) });
    assert.equal(malo.success, false, "la interfaz se puede saltar: un PATCH a mano no pasa por ella");
    assert.match(malo.error.issues[0].message, /Faltan 2 caracteres/, "el 400 tiene que decir qué pasa");

    const bueno = FamiliaNuevaSchema.safeParse({ nombre: "X", codigo_sepa: "ES91 2100 0418 4502 0005 1332" });
    assert.equal(bueno.success, true);
    assert.equal(bueno.data.codigo_sepa, ES_VALIDO, "y se guarda normalizado, sin espacios");
  });

  test("una familia sin IBAN se sigue pudiendo guardar", async () => {
    const { FamiliaNuevaSchema } = await import("../../server/lib/academiaAlumnoSchemas.js");
    for (const v of ["", null, undefined]) {
      assert.equal(
        FamiliaNuevaSchema.safeParse({ nombre: "X", codigo_sepa: v }).success, true,
        `${JSON.stringify(v)} tiene que pasar: exigir IBAN bloquearía altas que hoy funcionan`
      );
    }
  });

  test("REGRESIÓN: el formulario y el backend usan LA MISMA función", () => {
    // Si alguien copia la validación al navegador, el día que se ajuste una
    // de las dos copias empezarán a discrepar — y "válido" aquí decide si un
    // recibo se cobra.
    const front = fs.readFileSync(
      new URL("../../assets/academia/admin/js/drawer/familia/familiaFields.js", import.meta.url), "utf8"
    );
    assert.match(front, /from "[^"]*shared\/js\/iban\.js"/);
    const esquemas = fs.readFileSync(
      new URL("../../server/lib/academiaAlumnoSchemas.js", import.meta.url), "utf8"
    );
    assert.match(esquemas, /from "[^"]*assets\/shared\/js\/iban\.js"/);
  });

  test("REGRESIÓN: guardar está bloqueado si el IBAN no cuadra", () => {
    // El aviso debajo del campo no basta: hay que impedir el guardado, o el
    // IBAN malo entra igual. Las tres puertas que escriben codigo_sepa.
    const selector = fs.readFileSync(
      new URL("../../assets/academia/admin/js/drawer/familia/selectorFamiliaDrawer.js", import.meta.url), "utf8"
    );
    const seccion = fs.readFileSync(
      new URL("../../assets/academia/admin/js/drawer/familiaSection.js", import.meta.url), "utf8"
    );
    const acciones = fs.readFileSync(
      new URL("../../assets/academia/admin/js/drawer/alumnoDrawerActions.js", import.meta.url), "utf8"
    );
    assert.match(selector, /if \(!fields\.ibanEsValido\(\)\)/, "crear familia no comprueba el IBAN");
    assert.match(seccion, /ibanEsValido:/, "familiaSection no expone la comprobación");
    assert.match(acciones, /ibanEsValido\(\)\)/, "guardar alumno no comprueba el IBAN de la familia editada");
  });
}
