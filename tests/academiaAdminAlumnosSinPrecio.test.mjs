import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// El aviso de "alumnos activos sin precio" del panel Envío a familias.
//
// EL FALLO QUE ARREGLA (ensayo del cierre de septiembre de 2026, hecho
// contra producción). El lote suma el precio_bruto de los alumnos activos de
// cada familia; un alumno sin tarifa suma 0, así que el recibo se generaba
// igual, salía por 0 € y se enviaba a la familia sin que nada avisara. En
// Lyceo había un caso real: un alumno activo sin tarifa entre 20 familias.
//
// LO QUE ESTOS TESTS PROTEGEN, por orden de importancia:
//   1. Que "sin tarifa" y "tarifa de 0 €" NO se confundan. Es lo único que
//      separa un aviso útil de uno que sale cada mes por las becas y se deja
//      de leer.
//   2. Que ante un backend que no manda `tiene_tarifa` el aviso CALLE, en
//      vez de acusar a todo el mundo de no tener precio.
//   3. Que el aviso nombre a los alumnos: "revisa los precios" no sirve para
//      encontrar a nadie entre 45 fichas.
function alumno({ id = "a1", nombre = "Ana", curso = "3º ESO", tieneTarifa = true, bruto = 70 } = {}) {
  return { id, nombre, curso, tiene_tarifa: tieneTarifa, precio_bruto: bruto };
}

function familia({ id = "f1", nombre = "Familia Uno", alumnos = [] } = {}) {
  return { familia_id: id, familia_nombre: nombre, familia_email: "f@example.com", alumnos_activos: alumnos };
}

export async function run({ test, assert }) {
  const { alumnosSinPrecio, textoAvisoSinPrecio, buildAvisoSinPrecio } = await import(
    "../assets/academia/admin/js/sections/envioFamilias/alumnosSinPrecio.js"
  );

  test("REGRESIÓN: un alumno activo SIN TARIFA se detecta", () => {
    const items = [familia({ alumnos: [alumno({ nombre: "Santiago", tieneTarifa: false, bruto: 0 })] })];
    const encontrados = alumnosSinPrecio(items);
    assert.equal(encontrados.length, 1);
    assert.equal(encontrados[0].nombre, "Santiago");
  });

  test("REGRESIÓN: una TARIFA DE 0 € no es un olvido y NO se avisa", () => {
    // Una beca, el hijo de alguien del centro: el importe es 0 a propósito.
    // Si esto avisara, el aviso saldría todos los meses para siempre y
    // dejaría de leerse justo el mes que avisa de algo real.
    const items = [familia({ alumnos: [alumno({ nombre: "Becado", tieneTarifa: true, bruto: 0 })] })];
    assert.deepEqual(alumnosSinPrecio(items), []);
  });

  test("REGRESIÓN: sin el campo `tiene_tarifa` el aviso CALLA, no acusa", () => {
    // Backend viejo, o un test que no lo simula. Sin el campo no hay forma
    // de distinguir el olvido de la beca, y un aviso falso sobre 20 familias
    // es peor que ninguno: se aprende a ignorarlo el primer día.
    const items = [familia({ alumnos: [{ id: "a1", nombre: "Ana", curso: "3º ESO", precio_bruto: 0 }] })];
    assert.deepEqual(alumnosSinPrecio(items), []);
  });

  test("el alumno viene con su familia, para poder encontrarlo", () => {
    const items = [
      familia({ id: "f9", nombre: "Luz Solano", alumnos: [alumno({ nombre: "Santiago", tieneTarifa: false })] }),
    ];
    const [encontrado] = alumnosSinPrecio(items);
    assert.equal(encontrado.familiaId, "f9");
    assert.equal(encontrado.familiaNombre, "Luz Solano");
  });

  test("recorre TODAS las familias y todos sus alumnos, no solo el primero", () => {
    const items = [
      familia({ id: "f1", alumnos: [alumno({ id: "a1" }), alumno({ id: "a2", nombre: "Hermano", tieneTarifa: false })] }),
      familia({ id: "f2", alumnos: [alumno({ id: "a3", nombre: "Otro", tieneTarifa: false })] }),
      familia({ id: "f3", alumnos: [] }),
    ];
    assert.deepEqual(alumnosSinPrecio(items).map((a) => a.nombre), ["Hermano", "Otro"]);
  });

  test("aguanta un listado vacío, sin alumnos_activos o sin argumento", () => {
    assert.deepEqual(alumnosSinPrecio([]), []);
    assert.deepEqual(alumnosSinPrecio(), []);
    assert.deepEqual(alumnosSinPrecio([{ familia_id: "f1", familia_nombre: "X" }]), []);
  });

  test("el texto nombra al alumno y dice qué pasaría, no solo que algo va mal", () => {
    const texto = textoAvisoSinPrecio([{ nombre: "Santiago", curso: "4º ESO" }]);
    assert.match(texto, /Santiago/);
    assert.match(texto, /4º ESO/);
    assert.match(texto, /0 €/);
  });

  test("con varios: dice cuántos son y los lista", () => {
    const texto = textoAvisoSinPrecio([
      { nombre: "Ana", curso: "1º ESO" },
      { nombre: "Luis", curso: "2º ESO" },
    ]);
    assert.match(texto, /2 alumnos/);
    assert.match(texto, /Ana/);
    assert.match(texto, /Luis/);
  });

  test("con muchos, corta la lista en vez de romper la cabecera", () => {
    const muchos = Array.from({ length: 9 }, (_, i) => ({ nombre: `Alumno${i}`, curso: "1º ESO" }));
    const texto = textoAvisoSinPrecio(muchos);
    assert.match(texto, /9 alumnos/);
    assert.match(texto, /y 3 más/);
    assert.equal(texto.includes("Alumno8"), false);
  });

  test("un alumno sin curso no imprime un paréntesis vacío", () => {
    assert.equal(textoAvisoSinPrecio([{ nombre: "Ana", curso: null }]).includes("()"), false);
  });

  test("sin nadie a quien avisar, no hay texto ni nodo", () => {
    assert.equal(textoAvisoSinPrecio([]), "");
    // null, no un div vacío: quien lo llama inserta el nodo sin repetir la
    // comprobación, y un div vacío dejaría el margen del aviso ocupando
    // sitio encima de la lista todos los meses.
    assert.equal(buildAvisoSinPrecio([familia({ alumnos: [alumno()] })]), null);
  });

  test("el nodo lleva el texto, el icono de aviso y role=status", () => {
    const nodo = buildAvisoSinPrecio([
      familia({ alumnos: [alumno({ nombre: "Santiago", curso: "4º ESO", tieneTarifa: false })] }),
    ]);
    assert.ok(nodo);
    assert.match(nodo.textContent, /Santiago/);
    assert.ok(nodo.querySelector("svg"), "sin icono no se distingue de un párrafo cualquiera");
    // status y no alert: es algo que mirar antes de generar, no un error que
    // deba interrumpir la lectura de un lector de pantalla.
    assert.equal(nodo.getAttribute("role"), "status");
  });
}
