import fs from "node:fs";

// El SELECT de la hoja para familias tiene que pedir TODAS las columnas de
// academia_config que lee el payload.
//
// EL FALLO QUE ESTE TEST HABRÍA COGIDO (08/09/2026). La ruta no pedía
// `max_alumnos_por_franja` ni `horario_reservas`. Nada falló: un campo que
// no viene en el select llega como `undefined`, y `undefined` se lee aquí
// como "este centro no tiene tope" y "no hay cursos reservados" — dos
// estados legítimos. Resultado: la hoja que se reparte a las familias salía
// con la rejilla entera en blanco, sin una sola hora en rojo, diciendo que
// había sitio a todas horas. Lo vio Jorge mirando el papel, no un test.
//
// POR QUÉ NO BASTA CON PROBAR EL PDF. Los tests del payload le pasan una
// config a mano, con todos los campos puestos, así que pasan igual de verdes
// con el select roto. El único sitio donde el fallo existe es la frontera
// entre la consulta y quien la consume, y esa frontera solo se puede mirar
// comparando las dos listas.
//
// ES UN TEST DE TEXTO, y eso es una limitación consciente: si alguien lee la
// config de otra forma (desestructurando, o con una variable intermedia)
// este test no se entera. Cubre la forma en que el payload está escrito hoy
// —`config.campo` / `config?.campo`— que es la que se ha roto de verdad.
const RUTA = "../../server/routes/v1/academia-documentos/hojaFamilias.routes.js";
const PAYLOAD = "../../server/lib/academiaHojaFamilias/payloadHojaFamilias.js";
// bloquesDeConfig y diasDeConfig leen la config por su cuenta: sus campos
// también tienen que viajar en el select aunque el payload no los nombre.
const HELPERS = ["../../assets/shared/js/horarioBloques.js"];

function leer(rel) {
  return fs.readFileSync(new URL(rel, import.meta.url), "utf8");
}

function camposLeidosDe(src) {
  return new Set([...src.matchAll(/config\??\.([a-z_0-9]+)/g)].map((m) => m[1]));
}

export async function run({ test, assert }) {
  const rutaSrc = leer(RUTA);
  const columnas = new Set(
    (rutaSrc.match(/const COLUMNAS\s*=\s*([\s\S]*?);/)?.[1] || "")
      .replace(/["'+\n]/g, " ")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
  );

  test("el SELECT no está vacío (si no, el resto de este test no probaría nada)", () => {
    assert.ok(columnas.size > 5, `solo se han leído ${columnas.size} columnas`);
  });

  test("REGRESIÓN: pide max_alumnos_por_franja — sin él ninguna hora sale en rojo", () => {
    assert.ok(columnas.has("max_alumnos_por_franja"));
  });

  test("REGRESIÓN: pide horario_reservas — sin él no salen los cursos por hora", () => {
    assert.ok(columnas.has("horario_reservas"));
  });

  test("REGRESIÓN: pide TODO lo que lee el payload, sea lo que sea el día de mañana", () => {
    // Este es el que de verdad protege: los dos de arriba nombran el fallo
    // conocido, este coge el siguiente campo que alguien añada al payload y
    // se olvide de pedir.
    const leidos = camposLeidosDe([leer(PAYLOAD), ...HELPERS.map(leer)].join("\n"));
    const faltan = [...leidos].filter((campo) => !columnas.has(campo)).sort();
    assert.deepEqual(faltan, [], `el payload lee columnas que el SELECT no pide: ${faltan.join(", ")}`);
  });

  test("y la ruta sigue pasando las franjas vigentes, que son la otra mitad", () => {
    // El tope sin las franjas tampoco marca nada: hacen falta los dos.
    assert.match(rutaSrc, /from\("academia_horario"\)/);
    assert.match(rutaSrc, /\.is\("fecha_fin", null\)/);
    assert.match(rutaSrc, /franjas,/);
  });

  test("REGRESIÓN: y las filtra por alumno activo con la función compartida", () => {
    // Si alguien vuelve a pasar las filas crudas, los borradores cuentan
    // otra vez y la hoja marca horas completas que no lo están. El criterio
    // vive en franjasQueOcupanPlaza (ocupacionHoja.js), no aquí.
    assert.match(rutaSrc, /franjasQueOcupanPlaza\(/);
    assert.match(rutaSrc, /academia_alumnos\(activo\)/, "el select tiene que traer el activo del alumno");
  });
}
