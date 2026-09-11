import fs from "node:fs";

// Los campos que el profesor ESCRIBE se distinguen de los que ELIGE.
//
// POR QUÉ (Jorge, 11/09/2026, mirando el drawer del diario): los textos de
// ejemplo de "Tema trabajado" y "Nota para el informe familiar" salían con
// el mismo peso que un texto escrito de verdad — "parece que ya está
// escrito" — y un campo que parece lleno es un campo que nadie rellena. Y
// los dos recuadros no se distinguían del resto del formulario, siendo lo
// único del parte que no se puede rellenar a golpes de ratón.
//
// La clase .ac-campo-escritura hace dos cosas en direcciones opuestas: marca
// el RECUADRO con el cobre de la casa, y apaga el TEXTO DE EJEMPLO en
// cursiva. El campo llama la atención; su ejemplo deja de fingir que es
// contenido.
//
// Son tres campos, ni uno más: tema, nota para el informe y motivo de la
// ausencia. El selector de asignatura y el de notificación no llevan la
// clase porque no se escriben, se eligen.
const RAIZ = new URL("../../", import.meta.url).pathname;

export async function run({ test, assert }) {
  const css = fs.readFileSync(
    `${RAIZ}assets/shared/styles/components/diario-horario.css`, "utf8"
  );
  const asignatura = fs.readFileSync(
    `${RAIZ}assets/academia/profesor/js/asignaturaBlock.js`, "utf8"
  );
  const drawer = fs.readFileSync(
    `${RAIZ}assets/academia/profesor/js/diarioDrawerBody.js`, "utf8"
  );

  test("el estilo vive en el CSS COMPARTIDO, no en el del panel de profesor", () => {
    // El diario se usa en los dos paneles: profesor y "Dar clase" dentro de
    // admin, que NO carga _academia-profesor.css. Poner esto allí habría
    // dejado el arreglo a medias justo en la pantalla de la captura de
    // Jorge, que era la de admin.
    assert.match(css, /\.ac-campo-escritura\s*\{/);
    for (const hoja of [
      "assets/academia/admin/css/_academia-admin.css",
      "assets/academia/profesor/css/_academia-profesor.css",
    ]) {
      assert.match(
        fs.readFileSync(`${RAIZ}${hoja}`, "utf8"), /diario-horario\.css/,
        `${hoja} no importa la hoja compartida`
      );
    }
  });

  test("el recuadro se marca con el cobre, y más al enfocar", () => {
    assert.match(css, /\.ac-campo-escritura\s*\{[^}]*border-color:\s*rgba\(196,131,74/);
    assert.match(css, /\.ac-campo-escritura:focus\s*\{[^}]*var\(--copper/);
  });

  test("REGRESIÓN: el texto de ejemplo se apaga y va en cursiva", () => {
    // La cursiva es la señal fuerte: se lee como sugerencia antes de leer su
    // contenido. Sin ella, bajar la opacidad solo lo hace más difícil de
    // leer sin dejar de parecer un texto escrito.
    const regla = css.match(/\.ac-campo-escritura::placeholder\s*\{([^}]*)\}/);
    assert.ok(regla, "no hay regla de placeholder para estos campos");
    assert.match(regla[1], /font-style:\s*italic/);
    assert.match(regla[1], /color:\s*rgba\(242,237,229,0\.2[0-9]\)/, "más apagado que el 0.35 de un campo normal");
  });

  test("y también en el tema claro: los dos temas o ninguno", () => {
    const claro = css.match(/\.ac-claro \.ac-campo-escritura::placeholder\s*\{([^}]*)\}/);
    assert.ok(claro, "el tema claro se ha quedado sin la regla");
    assert.match(claro[1], /font-style:\s*italic/);
  });

  test("los tres campos que se escriben llevan la clase", () => {
    assert.match(
      asignatura, /temaInput\.className = "ac-input ac-campo-escritura"/,
      "Tema trabajado"
    );
    // Los dos textarea pasan por buildField con destacado:true. Se cuentan
    // solo las líneas de código (el comentario de buildField también dice
    // "destacado: true", y contarlo daba tres).
    const conDestacado = drawer.split("\n")
      .filter((l) => /^\s+destacado:\s*true,\s*$/.test(l)).length;
    assert.equal(conDestacado, 2, "deberían ser dos: nota para el informe y motivo de ausencia");
    assert.match(drawer, /if \(destacado\) input\.classList\.add\("ac-campo-escritura"\)/);
  });

  test("REGRESIÓN: la ausencia también, que es la otra pantalla donde se escribe", () => {
    // Se pidió expresamente ("lo mismo en la subpantalla de marcar
    // ausencia") y es fácil de olvidar porque es otro modo del mismo drawer.
    const bloqueAusencia = drawer.slice(drawer.indexOf("buildAusenciaEditBody"));
    assert.match(bloqueAusencia, /Motivo de ausencia[\s\S]{0,200}destacado:\s*true/);
  });

  test("lo que se ELIGE no lleva la clase", () => {
    // Si se la ponemos a todo, deja de señalar nada. El selector de
    // notificar sí/no es el ejemplo claro: son dos tarjetas que se pulsan.
    // El CUERPO de la función, hasta su llave de cierre en columna 0: entre
    // ella y buildField hay un comentario que nombra la clase, y cortar por
    // ahí hacía que el test se disparara con su propia documentación.
    const desde = drawer.indexOf("function buildNotifSelector");
    const notif = drawer.slice(desde, drawer.indexOf("\n}\n", desde));
    assert.ok(notif.length > 200, "no se ha encontrado buildNotifSelector");
    assert.equal(/ac-campo-escritura/.test(notif), false);
  });
}
