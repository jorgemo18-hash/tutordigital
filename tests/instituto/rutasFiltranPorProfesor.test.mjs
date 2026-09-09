import fs from "node:fs";

// Que las rutas del instituto SIGAN comprobando quién puede ver a quién.
//
// POR QUÉ UN TEST ESTRUCTURAL. La comprobación es una llamada al principio
// del handler; si alguien la quita, no falla nada visible: la ruta sigue
// devolviendo datos, solo que a quien no debe. Es exactamente la forma del
// fallo que se acaba de cerrar —el aislamiento del instituto era por centro
// y nadie se enteró durante meses— y la única defensa barata es comprobar
// que la llamada está.
//
// No sustituye a los tests del helper (alumnosVisibles.test.mjs), que son
// los que prueban la regla. Este solo garantiza que las rutas la usan.
const RUTAS = [
  // [archivo, helpers que tiene que usar, cuántas comprobaciones como mínimo, por qué importa]
  //
  // EL NÚMERO NO ES DECORACIÓN. La primera versión de este test solo miraba
  // que el archivo MENCIONARA el helper, y se comprobó que no servía: al
  // quitar a mano la comprobación del DELETE de alumnos, la suite siguió en
  // verde porque quedaban otras menciones en el mismo archivo. Un archivo
  // con seis puntos de entrada necesita seis comprobaciones, y perder una
  // es exactamente el fallo que puede pasar. Si se añade una ruta nueva con
  // su guarda, este número sube; si baja, alguien ha quitado una.
  ["server/routes/v1/session/detail.routes.js", ["verificarAlumnoVisible"], 1,
    "devuelve la conversación entera del alumno con el tutor y la nota de su profesor"],
  ["server/routes/v1/session/by-task.routes.js", ["verificarAlumnoVisible"], 1,
    "historial de sesiones de un alumno, con el student_id llegando del query"],
  ["server/routes/v1/session/map.routes.js", ["verificarAlumnoVisible"], 1,
    "el mapa lleva el enunciado troceado de los ejercicios del alumno"],
  ["server/routes/v1/student-notes.routes.js", ["verificarGrupoVisible", "verificarAlumnoVisible"], 2,
    "las notas que el profesor escribe sobre un alumno; el group_id llega del query"],
  ["server/routes/v1/tutor-sessions.routes.js", ["verificarGrupoVisible", "verificarAlumnoVisible"], 2,
    "listado por grupo, y marcar 'revisado' apaga el aviso en el cuaderno de otro profesor"],
  ["server/routes/v1/notebook.routes.js", ["verificarAlumnoVisible"], 3,
    "leer, poner y editar las notas del cuaderno de un alumno"],
  ["server/routes/v1/notebookSummary.routes.js", ["verificarGrupoVisible"], 1,
    "el cuaderno agregado de un grupo entero, con el group_id llegando del query"],
  ["server/routes/v1/grades.routes.js", ["verificarAlumnoVisible", "verificarGrupoVisible", "resolverAlumnoIdsVisibles"], 7,
    "las calificaciones son el expediente del alumno: leer, poner, cambiar, borrar y el lote"],
  ["server/routes/v1/students.routes.js", ["verificarAlumnoVisible", "verificarGrupoVisible", "resolverGrupoIdsVisibles"], 5,
    "la lista de alumnos del centro, y crear/mover/borrar alumnos"],
];

// Rutas del instituto que TODAVÍA filtran solo por centro. Están aquí a
// propósito: es la lista de lo que queda, y el test de abajo falla si alguna
// se arregla sin sacarla de aquí — así la lista no se queda mintiendo.
//
// `groups.routes.js` sí filtra por profesor, pero con getTeacherAssignedGroupIds,
// que devuelve null (= "no restringir") tanto sin ficha de profesor como al
// fallar la consulta. Falla ABIERTO, así que sigue contando como pendiente.
// `tasks.routes.js` toma group_id y student_id del query sin comprobarlos.
const PENDIENTES = [
  "server/routes/v1/groups.routes.js",
  "server/routes/v1/tasks.routes.js",
];

function leer(rel) {
  return fs.readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

export async function run({ test, assert }) {
  for (const [ruta, helpers, minimo, porQue] of RUTAS) {
    test(`REGRESIÓN: ${ruta.split("/").pop()} filtra por profesor — ${porQue}`, () => {
      const src = leer(ruta);
      assert.match(src, /lib\/instituto\/alumnosVisibles\.js/, `${ruta} ya no importa el helper`);
      for (const helper of helpers) {
        assert.match(src, new RegExp(`${helper}\\(`), `${ruta} ya no llama a ${helper}`);
      }
      const llamadas = (src.match(/await (?:verificar|resolver|bloqueoPorAlumno)/g) || []).length;
      assert.ok(
        llamadas >= minimo,
        `${ruta} tiene ${llamadas} comprobaciones y debería tener al menos ${minimo}: ` +
        "alguien ha quitado una de un handler, y el resto del archivo la sigue teniendo"
      );
    });
  }

  test("REGRESIÓN: un fallo al comprobar la visibilidad NUNCA deja pasar", () => {
    // El helper viejo del instituto devolvía null al fallar y quien llamaba
    // lo leía como "no filtrar". Cada ruta tiene que tratar
    // visibilidad_fetch_failed como un 500, no seguir adelante.
    for (const [ruta] of RUTAS) {
      const src = leer(ruta);
      assert.match(src, /visibilidad_fetch_failed/,
        `${ruta} no distingue el error de la denegación: un hipo de la base de datos abriría el centro`);
    }
  });

  test("la lista de rutas pendientes sigue siendo cierta", () => {
    // Si una de estas ya usa el helper bueno, está arreglada y hay que
    // moverla arriba. Una lista de deuda desactualizada es peor que no
    // tenerla: se lee, se cree, y se deja de mirar.
    for (const ruta of PENDIENTES) {
      const src = leer(ruta);
      assert.equal(
        src.includes("lib/instituto/alumnosVisibles.js"), false,
        `${ruta} ya filtra por profesor: muévela a RUTAS y quítala de PENDIENTES`
      );
    }
  });

  test("nadie vuelve a usar el helper que falla abierto en estas rutas", () => {
    // getTeacherAssignedGroupIds devuelve null tanto si el profesor no tiene
    // ficha COMO SI LA CONSULTA FALLA, y quien lo llama lo entiende como "no
    // restringir". Sigue vivo en groups.routes.js (pendiente), pero no debe
    // colarse en las rutas ya cerradas.
    for (const [ruta] of RUTAS) {
      assert.equal(
        leer(ruta).includes("getTeacherAssignedGroupIds"), false,
        `${ruta} usa el helper que falla abierto`
      );
    }
  });
}
