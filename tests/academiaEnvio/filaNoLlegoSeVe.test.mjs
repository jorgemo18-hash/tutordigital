import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// LA FILA, PINTADA DE VERDAD.
//
// Los otros tests comprueban que el estado se calcula bien. Este comprueba
// que se VE, que es distinto: `calcularEstadoFamilia` puede devolver
// "no_llego" perfectamente y la fila pintarlo con el mismo punto gris que
// "sin recibo este mes", y entonces no sirve de nada.
//
// Tres cosas se vigilan aquí, y las tres se pueden romper sin dar error:
//   - el punto usa SU clase (y esa clase existe en el CSS);
//   - la fila lleva el triángulo de aviso, igual que "sin email";
//   - el motivo COMPLETO está en el `title`, porque en la fila va recortado
//     y lo que hace falta para arreglarlo es el texto entero.
export async function run({ test, assert }) {
  const fs = await import("node:fs");
  const { buildFamiliasLista } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/familiasLista.js"
  );

  const MOTIVO = "Permanent · General · Recipient address does not exist";

  function familia(envioEmail) {
    return {
      familia_id: "f1",
      familia_nombre: "Familia Ruiz",
      familia_email: "ruiz@example.com",
      recibo: { id: "r1", estado: "enviado", fecha_envio: "2026-09-17T19:10:00.000Z" },
      alumnos_activos: [{ id: "a1", curso: "1º ESO", tiene_sesiones: false, informe_enviado_at: null }],
      envio_email: envioEmail,
    };
  }

  function pintar(envioEmail) {
    const lista = buildFamiliasLista([familia(envioEmail)], { selectedId: null, onSelect: () => {} });
    return lista.querySelector(".ef-fila");
  }

  test("EL PUNTO DE TODO: el punto de la fila usa la clase de 'no llegó'", () => {
    const fila = pintar({ estado: "rebotado", motivo: MOTIVO });
    const dot = fila.querySelector(".ef-dot");
    assert.ok(dot.className.includes("ef-dot--no-llego"), `clases: ${dot.className}`);
  });

  test("y esa clase existe en el CSS — si no, el punto se queda sin color", () => {
    // Una clase que el JS pinta y el CSS no conoce no da ningún error: el
    // punto sale transparente y el aviso pasa desapercibido.
    const css = fs.readFileSync("assets/academia/admin/css/_academia-admin-secciones.css", "utf8");
    assert.ok(css.includes(".ef-dot--no-llego"), "falta la regla en _academia-admin-secciones.css");
  });

  test("el rojo de 'no llegó' NO es el mismo que el del error transitorio", () => {
    // Son dos cosas distintas: "no se pudo enviar ahora mismo" (se reintenta)
    // y "la familia no tiene el email" (hay que corregir la dirección).
    const css = fs.readFileSync("assets/academia/admin/css/_academia-admin-secciones.css", "utf8");
    const color = (clase) => css.match(new RegExp(`\\${clase}\\s*\\{[^}]*background:\\s*([^;]+);`))?.[1]?.trim();
    const noLlego = color(".ef-dot--no-llego");
    const error = color(".ef-dot--error");
    assert.ok(noLlego, "sin color declarado");
    assert.notEqual(noLlego, error, "si son el mismo rojo, no se distinguen");
  });

  test("la fila lleva el triángulo de aviso, como 'sin email'", () => {
    const fila = pintar({ estado: "rebotado", motivo: MOTIVO });
    assert.ok(fila.querySelector("svg"), "sin icono, hay que leerse la línea pequeña para verlo");
  });

  test("el aviso COMPLETO está en el title, sin recortar y en castellano", () => {
    // Desde el 23/09 el title ya no es el texto del proveedor tal cual: es su
    // traducción, que acaba diciendo qué hacer, más la clasificación
    // original para el soporte (ver motivoEntrega.js).
    const fila = pintar({ estado: "rebotado", motivo: MOTIVO });
    assert.ok(fila.title.includes("corregir el email"), fila.title);
    assert.ok(fila.title.includes("Detalle técnico: Permanent · General"), fila.title);
    assert.ok(fila.textContent.includes("No llegó"), fila.textContent);
  });

  test("REGRESIÓN: una familia entregada se pinta como siempre, sin aviso ni title", () => {
    const fila = pintar({ estado: "entregado", motivo: null });
    assert.ok(fila.querySelector(".ef-dot").className.includes("ef-dot--enviado"));
    assert.ok(!fila.title, `no debería llevar title: "${fila.title}"`);
    assert.ok(!fila.querySelector("svg"), "ni triángulo");
  });

  test("REGRESIÓN: sin envio_email (lo de antes de la 122) la fila no cambia", () => {
    const fila = pintar(null);
    assert.ok(fila.querySelector(".ef-dot").className.includes("ef-dot--enviado"));
    assert.ok(!fila.querySelector("svg"));
  });
}
