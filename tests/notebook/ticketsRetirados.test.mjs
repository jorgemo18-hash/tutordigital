import fs from "node:fs";
import path from "node:path";

// Los tickets se retiraron del panel. Esto impide que vuelvan por la puerta
// de atrás.
//
// QUÉ ERA. Un segundo canal para lo mismo que hoy hace la nota al profesor:
// el alumno pulsaba "Pedir ayuda al profesor", se copiaban los últimos ocho
// mensajes en un campo de texto y se creaba una fila en `tickets`.
//
// POR QUÉ SE FUE (09/09/2026, todo comprobado, no supuesto):
//   - El botón del alumno estaba muerto: `pushTeacherCTA` se devolvía y no lo
//     llamaba nadie, y `onFinished` había dejado de crear tickets el día
//     anterior. Nada en la aplicación creaba ya un ticket.
//   - La lista del profesor también: `renderTickets` empezaba con
//     `if (!ctx.elements.ticketList) return;` y ese id no existía en ningún
//     HTML del proyecto. Llevaba meses sin pintar nada.
//   - El modal se abría desde `.nb-ticket-badge[data-ticket-id]`, un elemento
//     que nadie pintaba nunca.
//   - Y `estadoInfo`, que calculaba el estado de cada tarjeta a partir de los
//     tickets abiertos, se pasaba a `buildStudentCard`... que no lo usaba.
//
// Es decir: cuatro módulos, un modal y una tabla para un circuito que ya no
// tenía ni entrada ni salida. Lo que sí funciona está en las sesiones —
// `needs_help` enciende el aviso del cuaderno (ayudaDelCuaderno.test.mjs) y
// la nota al profesor recoge lo que el alumno quiera contar
// (instituto/notaAlTerminar.test.mjs).
//
// QUEDA PENDIENTE: la ruta /api/v1/tickets del backend y las 32 filas de
// mayo-junio. No se van en el mismo paso a propósito — el frontend viejo
// puede seguir cacheado en algún navegador durante un rato.
const RAIZ = new URL("../../", import.meta.url).pathname;

function archivos(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivos(p, acc);
    else if (/\.(js|html)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

export async function run({ test, assert }) {
  const frontend = [
    ...archivos(path.join(RAIZ, "assets/teacher")),
    ...archivos(path.join(RAIZ, "assets/student")),
  ];
  const fuentes = frontend.map((f) => [path.relative(RAIZ, f), fs.readFileSync(f, "utf8")]);

  test("los módulos de tickets ya no están", () => {
    for (const rel of [
      "assets/teacher/js/tickets.js",
      "assets/teacher/js/features/tickets.js",
      "assets/student/js/features/tickets.js",
      "assets/student/lib/tickets.js",
    ]) {
      assert.equal(fs.existsSync(path.join(RAIZ, rel)), false, `${rel} ha vuelto`);
    }
  });

  test("REGRESIÓN: ninguna pantalla llama ya a /api/v1/tickets", () => {
    // Si alguien vuelve a enchufar el canal viejo, tendrá que quitar este
    // test — y al quitarlo, leer arriba por qué se fue.
    const culpables = fuentes
      .filter(([, src]) => src.includes("/api/v1/tickets"))
      .map(([rel]) => rel);
    assert.deepEqual(culpables, []);
  });

  test("el estado de la tarjeta ya no se calcula con tickets abiertos", () => {
    const cards = fs.readFileSync(path.join(RAIZ, "assets/teacher/js/notebook-cards.js"), "utf8");
    assert.equal(/openTickets/.test(cards), false);
    // `estadoInfo` se calculaba y se pasaba a una función que lo ignoraba:
    // si vuelve, que sea porque alguien lo pinta.
    assert.equal(/estadoInfo/.test(cards), false);
  });

  test("el cuaderno no guarda ids de ticket en los dots", () => {
    const week = fs.readFileSync(path.join(RAIZ, "assets/teacher/js/notebook-week.js"), "utf8");
    assert.equal(/dataset\.ticketId/.test(week), false, "se escribía y no lo leía nadie");
  });

  test("no queda modal de ticket ni sus elementos", () => {
    const templates = fs.readFileSync(path.join(RAIZ, "assets/teacher/js/templates.js"), "utf8");
    const dom = fs.readFileSync(path.join(RAIZ, "assets/teacher/js/dom.js"), "utf8");
    assert.equal(/id="ticketModal"/.test(templates), false);
    assert.equal(/ticketModal|ticketResolveBtn/.test(dom), false);
  });

  test("el estado local del panel ya no guarda tickets", () => {
    const state = fs.readFileSync(path.join(RAIZ, "assets/teacher/js/state.js"), "utf8");
    assert.equal(/data\.tickets|activeTicketId/.test(state), false);
  });

  test("el drawer de sesión no depende de un módulo de tickets para abrirse", () => {
    // openSessionModal vivía en tickets.js y solo reenviaba a openSessionDrawer:
    // la parte viva del archivo muerto. Ahora modals.js llama al drawer directo.
    const modals = fs.readFileSync(path.join(RAIZ, "assets/teacher/js/modals.js"), "utf8");
    assert.match(modals, /import \{ openSessionDrawer \} from "\.\/session-drawer\.js"/);
    assert.match(modals, /openSessionDrawer\(ctx, \{/);
  });
}
