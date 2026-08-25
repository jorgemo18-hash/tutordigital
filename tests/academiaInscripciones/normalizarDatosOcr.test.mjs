// La hoja de inscripción de Lyceo tiene DOS bloques de datos personales
// (alumno y tutor), cada uno con su nombre, email y teléfono. El prompt
// antiguo devolvía un JSON plano con un único "nombre"/"email"/"telefono",
// el drawer lo aplicaba todo al alumno, y a la familia solo cruzaba el
// email — así que el nombre del tutor, su DNI, su teléfono y su dirección
// se reescribían a mano en cada alta.
//
// Estos tests fijan el reparto y la tolerancia al formato antiguo.
export async function run({ test, assert }) {
  const { normalizarDatosInscripcion, normalizarMetodoPago, unirNombreTutor } = await import(
    "../../server/lib/academiaInscripciones/normalizarDatosOcr.js"
  );

  const fichaCompleta = {
    alumno: {
      nombre: "Ana García López", curso: "1º ESO", email: "ana@example.com",
      telefono: "600111222", direccion: "", ciudad: "", codigo_postal: "",
    },
    familia: {
      nombre_tutor: "Marta", apellidos: "López Ruiz", dni: "12345678Z",
      email: "marta@example.com", telefono: "600333444",
      direccion: "Calle Mayor 3", ciudad: "Huesca", codigo_postal: "22001",
    },
    metodo_pago: "sepa",
  };

  test("REGRESIÓN: los datos del tutor llegan a la familia, no al alumno", () => {
    const { alumno, familia } = normalizarDatosInscripcion(fichaCompleta);
    assert.equal(alumno.nombre, "Ana García López");
    assert.equal(alumno.email, "ana@example.com");
    assert.equal(alumno.telefono, "600111222");
    assert.equal(familia.nombre, "Marta López Ruiz", "nombre y apellidos del tutor unidos");
    assert.equal(familia.dni, "12345678Z");
    assert.equal(familia.email, "marta@example.com");
    assert.equal(familia.telefono, "600333444");
    assert.equal(familia.direccion, "Calle Mayor 3");
    assert.equal(familia.codigo_postal, "22001");
  });

  test("'sepa' de la hoja se traduce al 'domiciliado' que admite la BD", () => {
    assert.equal(normalizarDatosInscripcion(fichaCompleta).familia.metodo_pago, "domiciliado");
  });

  test("un método de pago que no existe se descarta en vez de romper el guardado", () => {
    assert.equal(normalizarMetodoPago("paypal"), "");
    assert.equal(normalizarMetodoPago(""), "");
    assert.equal(normalizarMetodoPago("BIZUM"), "bizum", "sin distinguir mayúsculas");
  });

  test("los campos vacíos se omiten — no pueden borrar lo que ya escribió el admin", () => {
    const { alumno, familia } = normalizarDatosInscripcion({
      alumno: { nombre: "Ana", curso: "", email: "" },
      familia: { nombre_tutor: "", apellidos: "", dni: "  " },
      metodo_pago: "",
    });
    assert.deepEqual(Object.keys(alumno), ["nombre"]);
    assert.deepEqual(familia, {}, "sin ninguna clave que pise el formulario");
  });

  test("tutor con solo nombre de pila, sin apellidos", () => {
    assert.equal(unirNombreTutor("Marta", ""), "Marta");
    assert.equal(unirNombreTutor("", "López"), "López");
    assert.equal(unirNombreTutor("", ""), "");
  });

  test("formato antiguo y plano: no revienta y reparte con criterio", () => {
    const { alumno, familia } = normalizarDatosInscripcion({
      nombre: "Ana García", curso: "1º ESO", email: "ana@example.com",
      telefono: "600111222", dni: "12345678Z", direccion: "Calle Mayor 3",
      ciudad: "Huesca", codigo_postal: "22001", metodo_pago: "transferencia",
    });
    assert.equal(alumno.nombre, "Ana García");
    assert.equal(alumno.email, "ana@example.com");
    assert.equal(familia.dni, "12345678Z", "el DNI de la hoja es el del tutor");
    assert.equal(familia.direccion, "Calle Mayor 3");
    assert.equal(familia.metodo_pago, "transferencia");
    assert.equal(familia.nombre, undefined, "el formato plano no distingue el nombre del tutor");
  });

  test("respuesta nula o basura -> estructura vacía, nunca undefined", () => {
    for (const entrada of [null, undefined, "texto", 42, []]) {
      const r = normalizarDatosInscripcion(entrada);
      assert.deepEqual(r, { alumno: {}, familia: {} }, `entrada: ${JSON.stringify(entrada)}`);
    }
  });
}
