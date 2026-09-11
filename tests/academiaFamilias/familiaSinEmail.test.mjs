import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Una familia puede guardarse sin email, y eso se avisa donde importa.
//
// EL PROBLEMA (Jorge, 11/09/2026): *"me ha llamado gente que ya tengo
// inscrita, sé que van a venir, pero hasta que no vengan el primer día no
// les voy a poder dar la ficha... de momento está en borradores"*. Cuando le
// llaman se queda con el nombre y un móvil; cuando le escriben, con el
// email. Exigir el email para crear la familia dejaba a esos alumnos
// atascados en Borradores —fuera del horario y del diario— con el alumno ya
// viniendo a clase.
//
// POR QUÉ SE RELAJÓ EL EMAIL Y NO LA FAMILIA. Era la otra opción, la que
// planteaba Jorge ("desbloqueamos que no me deje guardar sin datos"), y es
// peor: `fetchFamiliasConAlumnos` agrupa por familia con un
// `if (!a.familia_id) continue;`, así que un alumno activo SIN FAMILIA
// desaparece del lote de recibos en silencio. No es un recibo raro que la
// madre ve: es no facturarle y no enterarse hasta cuadrar las cuentas. Con
// familia y sin email, el alumno entra entero en el sistema y lo único que
// falta es el canal de envío — que el backend ya maneja
// (enviarFamiliaEmail.js devuelve `sin_email` y sigue con el resto del lote).
//
// ES EL MISMO PRINCIPIO QUE EL RECIBO DE 0 €: el dato se exige en el momento
// en que hace falta de verdad (al enviar), no en el de crear. Y avisa, no
// bloquea: ese recibo se puede imprimir o mandar por WhatsApp.
const RAIZ = new URL("../../", import.meta.url).pathname;

export async function run({ test, assert }) {
  const { familiasSinEmail, textoAvisoSinEmail, buildAvisoSinEmail } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/familiasSinEmail.js"
  );

  const CON = { familia_id: "f1", familia_nombre: "Familia Sarvisé", familia_email: "a@b.es" };
  const SIN = { familia_id: "f2", familia_nombre: "Familia Nieto", familia_email: "" };
  const NULA = { familia_id: "f3", familia_nombre: "Familia Cid", familia_email: null };

  test("encuentra las familias sin email, vacío o nulo", () => {
    assert.deepEqual(
      familiasSinEmail([CON, SIN, NULA]).map((f) => f.nombre),
      ["Familia Nieto", "Familia Cid"]
    );
  });

  test("un email de solo espacios cuenta como que no hay", () => {
    assert.equal(familiasSinEmail([{ familia_id: "f4", familia_email: "   " }]).length, 1);
  });

  test("sin ninguna, no hay aviso", () => {
    assert.deepEqual(familiasSinEmail([CON]), []);
    assert.equal(buildAvisoSinEmail([CON]), null, "el aviso se pinta solo si hay algo que avisar");
    assert.equal(buildAvisoSinEmail([]), null);
  });

  test("REGRESIÓN: el texto dice que el recibo SÍ se genera", () => {
    // Es la mitad importante del mensaje. Si solo dijera "no tiene email",
    // quien lo lee no sabe si ese alumno está cobrado o no, que es lo único
    // que de verdad preocupa antes de pulsar Generar.
    const texto = textoAvisoSinEmail(familiasSinEmail([SIN]));
    assert.match(texto, /se genera/);
    assert.match(texto, /no se puede enviar/);
    assert.match(texto, /Familia Nieto/, "y con nombre, para poder ir a arreglarlo");
  });

  test("en plural dice cuántas son antes de la lista", () => {
    const texto = textoAvisoSinEmail(familiasSinEmail([SIN, NULA]));
    assert.match(texto, /^2 familias/);
  });

  test("con muchas, corta la lista y dice cuántas faltan", () => {
    // Un aviso con cuarenta nombres no se lee.
    const muchas = Array.from({ length: 9 }, (_, i) => ({
      familia_id: `f${i}`, familia_nombre: `Familia ${i}`, familia_email: "",
    }));
    assert.match(textoAvisoSinEmail(familiasSinEmail(muchas)), / y 3 más\./);
  });

  // ── Que el dato pueda entrar ──────────────────────────────────────────

  test("REGRESIÓN: crear la familia sin email ya no falla", async () => {
    const { CreateFamiliaSchema } = await import(
      "../../server/routes/v1/academia.familias.routes.js"
    );
    assert.equal(CreateFamiliaSchema.safeParse({ nombre: "Familia Nieto" }).success, true);
    assert.equal(
      CreateFamiliaSchema.safeParse({ nombre: "Familia Nieto", email: "roto@" }).success, false,
      "pero opcional no es 'vale cualquier cosa'"
    );
  });

  test("REGRESIÓN: la familia SIGUE siendo obligatoria para un alumno activo", () => {
    // Lo que NO se ha relajado, y el motivo por el que no: un alumno activo
    // sin familia se cae del lote de recibos sin decir nada.
    const acciones = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/drawer/alumnoDrawerActions.js`, "utf8"
    );
    assert.match(acciones, /exigirFamilia && !familiaValue\.familia_id/);
    const consultas = fs.readFileSync(
      `${RAIZ}server/lib/academiaRecibos/consultas.js`, "utf8"
    );
    assert.match(
      consultas, /if \(!a\.familia_id\) continue;/,
      "si esto cambiara, el motivo para exigir familia dejaría de existir"
    );
  });

  test("el drawer de crear familia ya no bloquea por el email", () => {
    const selector = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/drawer/familia/selectorFamiliaDrawer.js`, "utf8"
    );
    assert.equal(
      /El email de la familia es obligatorio/.test(selector), false,
      "seguiría atascando en Borradores al alumno que ya viene a clase"
    );
    assert.match(selector, /!datos\.nombre/, "el nombre sí sigue siendo obligatorio");
  });

  test("pero el formulario dice qué se pierde sin email", () => {
    // "Opcional" sin explicación se lee como "da igual".
    const campos = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/drawer/familia/familiaFields.js`, "utf8"
    );
    assert.match(campos, /Sin email, sus recibos e informes se generan pero no se pueden enviar/);
    assert.match(campos, /avisoEmail\.hidden = Boolean/, "y solo cuando está vacío");
  });

  // ── Que se vea ────────────────────────────────────────────────────────

  test("REGRESIÓN: el panel de envío pinta LOS DOS avisos", () => {
    // Sin precio y sin email son dos problemas con dos arreglos distintos y
    // pueden darse a la vez. Si uno tapara al otro, arreglar el primero
    // haría aparecer el segundo por sorpresa.
    const seccion = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/envioFamiliasSection.js`, "utf8"
    );
    assert.match(seccion, /buildAvisoSinPrecio\(familias\), buildAvisoSinEmail\(familias\)/);
  });

  test("REGRESIÓN: la fila del alumno también lo marca", () => {
    // Es donde Jorge se lo va a encontrar a diario, sin entrar en Envío.
    const fila = fs.readFileSync(`${RAIZ}assets/academia/admin/js/alumnosListRow.js`, "utf8");
    assert.match(fila, /el email de la familia/);
    assert.match(
      fila, /alumno\.familia && !String\(alumno\.familia\.email/,
      "solo si TIENE familia: 'sin familia' es otra cosa distinta"
    );
  });

  test("y la lista de lo que falta se lee en castellano", () => {
    // Con tres cosas, unirlas todas con \"y\" era un trabalenguas.
    const fila = fs.readFileSync(`${RAIZ}assets/academia/admin/js/alumnosListRow.js`, "utf8");
    assert.match(fila, /faltantes\.slice\(0, -1\)\.join\(", "\)/);
  });
}
