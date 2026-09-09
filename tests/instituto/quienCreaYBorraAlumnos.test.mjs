import fs from "node:fs";

// Quién puede crear, editar y borrar alumnos en el INSTITUTO.
//
// LA REGLA (Jorge, 09/09/2026): "el profesor no puede crear ni borrar, solo
// el admin". En un instituto es el admin quien asigna profesores y clases,
// así que dar de alta a un alumno —y sobre todo borrarlo, que se lleva su
// expediente por delante— es de secretaría, no del profesor de asignatura.
//
// ESTO ES SOLO INSTITUTO Y NO SE MEZCLA CON ACADEMIA. El panel de academia
// llama únicamente a /api/v1/academia/* y /api/v1/me (comprobado el 09/09:
// cero referencias a estas rutas en assets/academia/), donde el profesor es
// a menudo el dueño del centro y las reglas son otras. Hay un test abajo que
// vigila que esa separación siga siendo cierta.
const RUTA = "server/routes/v1/students.routes.js";

function leer(rel) {
  return fs.readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

// El bloque de un handler concreto: desde `app.<verbo>("/"` hasta el
// siguiente `app.`. Mirar el archivo entero no vale — tiene cuatro
// handlers y todos mencionan roles.
function handler(src, verbo) {
  const desde = src.indexOf(`app.${verbo}("/"`);
  if (desde < 0) return "";
  const siguiente = src.indexOf("\n  app.", desde + 10);
  return src.slice(desde, siguiente < 0 ? undefined : siguiente);
}

export async function run({ test, assert }) {
  const src = leer(RUTA);

  test("REGRESIÓN: crear un alumno es solo de admin", () => {
    assert.match(handler(src, "post"), /roles:\s*\["admin"\]/);
    assert.equal(/roles:\s*\[[^\]]*teacher/.test(handler(src, "post")), false);
  });

  test("REGRESIÓN: borrar un alumno es solo de admin", () => {
    // Es la más grave de las dos: el borrado arrastra su expediente.
    assert.match(handler(src, "delete"), /roles:\s*\["admin"\]/);
    assert.equal(/roles:\s*\[[^\]]*teacher/.test(handler(src, "delete")), false);
  });

  test("el profesor SÍ puede editar, pero solo el estado de trabajo", () => {
    // `status` (pendiente / entregado / necesita ayuda) lo sabe quien está
    // en el aula. El resto no.
    assert.match(handler(src, "patch"), /roles:\s*\[[^\]]*teacher/);
    assert.match(src, /CAMPOS_DE_PROFESOR = new Set\(\["id", "status"\]\)/);
  });

  test("REGRESIÓN: un profesor no puede colar group_id en el PATCH", () => {
    // Sin la lista blanca bastaba con mandar `group_id` en el mismo PATCH
    // para mover a un alumno de clase — que es justo lo que decide el admin.
    assert.match(handler(src, "patch"), /camposProhibidosParaProfesor\(/);
    assert.match(src, /Solo el administrador puede cambiar/);
    // Y que la comprobación vaya ANTES de tocar la base de datos.
    const h = handler(src, "patch");
    assert.ok(
      h.indexOf("camposProhibidosParaProfesor") < h.indexOf("createSupabaseAdmin"),
      "se comprueba después de abrir la conexión: el orden importa para no hacer trabajo de más"
    );
  });

  test("REGRESIÓN: la academia NO pasa por estas rutas", () => {
    // Si algún día el panel de academia llamara a /api/v1/students, el
    // filtro por teacher_groups —que en academia no existen— le dejaría la
    // lista vacía sin que nada fallara. Este test es la alarma.
    const RAIZ = new URL("../../assets/academia/", import.meta.url);
    const sospechosas = ["v1/students", "v1/grades", "v1/notebook", "v1/tutor-sessions", "v1/student-notes"];
    const encontradas = [];

    function recorrer(dir) {
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const hijo = new URL(`${entrada.name}${entrada.isDirectory() ? "/" : ""}`, dir);
        if (entrada.isDirectory()) recorrer(hijo);
        else if (entrada.name.endsWith(".js")) {
          const texto = fs.readFileSync(hijo, "utf8");
          for (const ruta of sospechosas) {
            if (texto.includes(ruta)) encontradas.push(`${entrada.name} -> ${ruta}`);
          }
        }
      }
    }
    recorrer(RAIZ);

    assert.deepEqual(
      encontradas, [],
      "el panel de academia ha empezado a llamar a rutas de instituto: revisa que el aislamiento por grupos no le deje sin datos"
    );
  });
}
