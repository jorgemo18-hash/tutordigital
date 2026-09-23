import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// LA FILA DICE DE QUÉ ALUMNOS ES.
//
// Jorge, 23/09: *"aparece el nombre de la familia para mandar los informes y
// recibos, pero yo conozco el nombre de los alumnos, no de las familias"*.
//
// Lo que se prueba aquí no es que "se vea bonito" sino las dos mitades de esa
// frase, que se pueden romper por separado:
//
//   - que los nombres de los alumnos ESTÉN en la fila;
//   - que el nombre de la familia SIGA estando, porque el recibo y el correo
//     van a la familia. Una fila que solo diga "Lucía" no dice a dónde va el
//     dinero.
export async function run({ test, assert }) {
  const fs = await import("node:fs");
  const { buildFamiliasLista } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/familiasLista.js"
  );

  const familia = (alumnos) => ({
    familia_id: "f1",
    familia_nombre: "Familia Ruiz",
    familia_email: "ruiz@example.com",
    recibo: { id: "r1", estado: "enviado", fecha_envio: "2026-09-17T19:10:00.000Z" },
    alumnos_activos: alumnos,
    envio_email: null,
  });

  const pintar = (alumnos) => buildFamiliasLista(
    [familia(alumnos)], { selectedId: null, onSelect: () => {} },
  ).querySelector(".ef-fila");

  const DOS = [
    { id: "a1", nombre: "Lucía Ruiz", curso: "1º ESO" },
    { id: "a2", nombre: "Gael Ruiz", curso: "3º ESO" },
  ];

  test("LOS NOMBRES DE LOS ALUMNOS SALEN EN LA FILA", () => {
    const fila = pintar(DOS);
    const sub = fila.querySelector(".ef-fila-sub").textContent;
    assert.ok(sub.includes("Lucía Ruiz"), sub);
    assert.ok(sub.includes("Gael Ruiz"), `falta el hermano: ${sub}`);
  });

  test("y el nombre de la familia SIGUE ARRIBA: es a quien se le manda", () => {
    const fila = pintar(DOS);
    assert.equal(fila.querySelector(".ef-fila-nombre").textContent, "Familia Ruiz");
  });

  test("el estado no se pierde al meter los nombres", () => {
    // La línea pequeña lleva las dos cosas. Si al añadir los alumnos se
    // hubiera sustituido el texto entero, la fila dejaría de decir si el
    // recibo está enviado o pendiente — que es para lo que se mira la lista.
    const sub = pintar(DOS).querySelector(".ef-fila-sub").textContent;
    assert.ok(sub.includes("·"), sub);
    assert.ok(/[A-Za-zÁÉÍÓÚáéíóú]/.test(sub.split("·").pop()), `sin estado: ${sub}`);
  });

  test("tres hermanos caben en el title aunque la línea se recorte", () => {
    // La columna mide 280px fijos y la línea va con ellipsis: sin `title`, la
    // familia de tres se queda en "Lucía Ruiz, Gael Ru…" y no se sabe quién
    // es el tercero sin abrirla.
    const tres = [...DOS, { id: "a3", nombre: "Martina Ruiz", curso: "5º Primaria" }];
    const sub = pintar(tres).querySelector(".ef-fila-sub");
    assert.ok(sub.title.includes("Martina Ruiz"), `title: "${sub.title}"`);

    const css = fs.readFileSync("assets/academia/admin/css/_academia-admin-secciones.css", "utf8");
    assert.ok(
      /\.ef-fila-sub\s*\{[^}]*text-overflow:\s*ellipsis/.test(css),
      "si la línea dejara de recortarse, el title sobraría y esto avisa",
    );
  });

  test("el title de la FILA sigue siendo el del rebote, no el de los alumnos", () => {
    // Los dos podrían querer el mismo hueco. El motivo del rebote es el que
    // manda: dice qué hay que arreglar, y los nombres ya se leen en la línea.
    const MOTIVO = "Permanent · General · Recipient address does not exist";
    const conRebote = buildFamiliasLista(
      [{ ...familia(DOS), envio_email: { estado: "rebotado", motivo: MOTIVO } }],
      { selectedId: null, onSelect: () => {} },
    ).querySelector(".ef-fila");
    assert.ok(conRebote.title.startsWith("El proveedor de correo"), conRebote.title);
    assert.ok(!conRebote.title.includes("Lucía"), "el title se lo han quedado los alumnos");
  });

  test("una familia sin alumnos con nombre no deja la línea colgando", () => {
    const sub = pintar([{ id: "a1", nombre: null, curso: "1º ESO" }]).querySelector(".ef-fila-sub");
    assert.ok(sub.textContent.length > 0, "la línea se queda vacía");
    assert.ok(!sub.textContent.startsWith("·"), `empieza por el separador: "${sub.textContent}"`);
  });

  test("EL PANEL DE LA DERECHA BAJA CON LA PANTALLA", () => {
    // Jorge, el mismo día: *"si bajo por la lista de alumnos, los informes y
    // recibos se quedan arriba"*.
    //
    // Y con `max-height`, que no es decoración: un elemento pegajoso más alto
    // que la pantalla se ancla por arriba y no hay manera de llegar a su
    // final — el botón de enviar se quedaría fuera.
    const css = fs.readFileSync("assets/academia/admin/css/_academia-admin-secciones.css", "utf8");
    const regla = css.match(/\.ef-panel-der\s*\{([^}]*)\}/)?.[1] || "";
    assert.ok(/position:\s*sticky/.test(regla), `.ef-panel-der no es pegajoso: ${regla}`);
    assert.ok(/top:\s*\d/.test(regla), "sin `top`, `sticky` no hace nada");
    assert.ok(/max-height:/.test(regla) && /overflow-y:\s*auto/.test(regla), regla);
  });
}
