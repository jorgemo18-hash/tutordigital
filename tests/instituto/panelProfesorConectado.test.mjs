import fs from "node:fs";
import path from "node:path";

// El panel del profesor (INSTITUTO) está a medio enchufar, y esto lo congela.
//
// QUÉ PASA. Los módulos de render leen `ctx.elements.X`, que sale de
// `dom.js` (un `getElementById` por cada uno). Cuando ese id no existe en el
// HTML, `elements.X` es `undefined`, y todos estos render empiezan igual:
//
//     if (!elements.studentList) return;
//
// Es decir: no fallan, no avisan, no escriben en consola. Simplemente no
// pintan nada. Así llevaba meses la lista de tickets: el backend los servía,
// el panel los pedía, y renderTickets se daba la vuelta en la primera línea
// porque su contenedor no existía en ningún HTML (09/09/2026).
//
// BORRAR O ENCHUFAR. Por defecto, ENCHUFAR: una pantalla desconectada suele
// ser funcionalidad escrita que nadie ató al HTML, y borrarla es tirar el
// trabajo. La excepción es cuando el circuito que alimentaba esa pantalla ya
// no existe: los tickets se retiraron enteros ese mismo día (nadie los crea
// desde que la nota al profesor los sustituyó), así que enchufar su lista
// habría sido enchufar una lista que siempre estaría vacía.
//
// CÓMO SE USA ESTE TEST. DESCONECTADOS de abajo es el inventario real de lo
// que falta por enchufar. Si enchufas una pantalla (añades su id al HTML),
// quítala de la lista y el test te lo confirma. Si aparece una nueva, el
// test falla: no se puede escribir otra pantalla que no pinte nada sin que
// salte aquí.
const RAIZ = new URL("../../assets/teacher/", import.meta.url).pathname;

// Ids que ningún HTML define hoy. Cada línea es una pantalla del panel del
// profesor que existe en JavaScript y no existe en pantalla.
const DESCONECTADOS = new Set([
  // Lista de alumnos del grupo (js/students.js)
  "studentList", "studentEmpty", "studentGroup", "studentGroupLabel",
  // Tareas con su contador de notas (js/features/tasks-section.js)
  "tasksGradeList", "tasksGradeEmpty",
  // Solicitudes de acceso de profesores (js/features/teacherRequests.js)
  "teacherRequestsList", "teacherRequestsEmpty", "teacherRequestsError",
  // Panel de administración dentro del panel de profesor (js/bootstrap/teacherBootstrap.js)
  "teacherAdminPanel",
  // Navegación por pestañas (js/modals.js, js/tasks.js)
  "tabs", "tasksPanel",
]);

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ, rel), "utf8");
}

function todosLosJs(dir, acc = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) todosLosJs(p, acc);
    else if (entrada.name.endsWith(".js")) acc.push(p);
  }
  return acc;
}

export async function run({ test, assert }) {
  const dom = leer("js/dom.js");
  // nombre en elements -> id que busca en el DOM
  const cacheados = new Map(
    [...dom.matchAll(/(\w+):\s*document\.getElementById\("([^"]+)"\)/g)].map((m) => [m[1], m[2]])
  );
  const markup = leer("index.html") + leer("js/templates.js");
  const idsExistentes = new Set([...markup.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

  // Todo `elements.X` que se lee en cualquier módulo del panel.
  const usados = new Map();
  for (const archivo of todosLosJs(path.join(RAIZ, "js"))) {
    const src = fs.readFileSync(archivo, "utf8");
    for (const m of src.matchAll(/(?:ctx\.)?elements\.(\w+)/g)) {
      if (!usados.has(m[1])) usados.set(m[1], new Set());
      usados.get(m[1]).add(path.basename(archivo));
    }
  }

  test("el barrido encuentra algo (si no, el resto del test no prueba nada)", () => {
    assert.ok(cacheados.size > 50, `solo ${cacheados.size} ids cacheados en dom.js`);
    assert.ok(usados.size > 50, `solo ${usados.size} elements.X encontrados`);
  });

  test("REGRESIÓN: no aparecen pantallas desconectadas NUEVAS", () => {
    // Una pantalla que no pinta nada y no avisa es el fallo más caro de
    // encontrar: no hay error, no hay log, solo un hueco en blanco que
    // alguien interpreta como "esto todavía no está hecho".
    const nuevos = [...usados.keys()].filter((k) => !cacheados.has(k) && !DESCONECTADOS.has(k));
    assert.deepEqual(
      nuevos.map((k) => `${k} (usado en ${[...usados.get(k)].join(", ")})`), [],
      "hay elements.X que dom.js no cachea y no están en la lista de conocidos: " +
      "o se enchufan al HTML, o se añaden a DESCONECTADOS con su motivo"
    );
  });

  test("la lista de desconectados sigue siendo cierta: ninguno se ha enchufado ya", () => {
    // Si alguien conecta una pantalla y no actualiza la lista, la lista pasa
    // a mentir — y una lista de deuda que miente se deja de mirar.
    const yaConectados = [...DESCONECTADOS].filter((k) => cacheados.has(k));
    assert.deepEqual(
      yaConectados, [],
      "estas pantallas ya se cachean en dom.js: quítalas de DESCONECTADOS"
    );
  });

  test("REGRESIÓN: dom.js no cachea ids que no existen en ningún HTML", () => {
    // Distinto del caso anterior: aquí dom.js SÍ lo busca, pero el id no
    // está en ninguna parte. Es basura que hace creer que la pantalla existe.
    const fantasma = [...cacheados.entries()]
      .filter(([, id]) => !idsExistentes.has(id))
      .map(([nombre, id]) => `${nombre} -> id="${id}"`);
    assert.deepEqual(fantasma, [], "dom.js busca ids que no existen en el HTML ni en templates.js");
  });
}
