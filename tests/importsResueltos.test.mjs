import fs from "node:fs";
import path from "node:path";

// Todo import relativo apunta a un archivo que existe.
//
// POR QUÉ HACE FALTA. El 09/09/2026 se borraron cuatro módulos de tickets.
// Si uno solo de los archivos que los importaban se hubiera quedado sin
// tocar, el navegador habría dado un 404 al cargar el módulo y el panel
// entero se habría quedado en blanco — sin error de servidor, sin test rojo,
// sin nada en el log del backend. Se ve al abrirlo, y solo si lo abres.
//
// Nada de lo que había lo detecta:
//   - ESLint no resuelve rutas (no-undef mira identificadores, no archivos);
//   - los tests importan los módulos que prueban, no todos;
//   - los smokes de Playwright mockean la API y no recorren cada pantalla.
//
// Este barrido es estático, tarda milisegundos y cubre borrados, renombrados
// y carpetas movidas. Es el complemento natural de lintNoUndef: aquella mira
// dentro de un archivo, esta mira entre archivos.
const RAICES = ["assets", "server", "tests"];

// Los dos: la forma estática con `from`, y la dinámica con paréntesis.
// (Ojo al escribir comentarios aquí: si se pone un ejemplo literal de un
// import, este mismo barrido lo encuentra y falla. Pasó al escribirlo.)
const ESTATICO = /(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+["'](\.[^"']+)["']/g;
const DINAMICO = /import\(\s*["'](\.[^"']+)["']\s*\)/g;

function archivosJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === "node_modules") continue;
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) archivosJs(p, acc);
    else if (/\.(js|mjs)$/.test(entrada.name)) acc.push(p);
  }
  return acc;
}

export async function run({ test, assert }) {
  const raizProyecto = new URL("..", import.meta.url).pathname;
  const archivos = RAICES.flatMap((r) => archivosJs(path.join(raizProyecto, r)));

  const rotos = [];
  for (const archivo of archivos) {
    const src = fs.readFileSync(archivo, "utf8");
    for (const re of [ESTATICO, DINAMICO]) {
      for (const m of src.matchAll(re)) {
        const destino = path.resolve(path.dirname(archivo), m[1]);
        if (!fs.existsSync(destino)) {
          rotos.push(`${path.relative(raizProyecto, archivo)} -> ${m[1]}`);
        }
      }
    }
  }

  test("el barrido encuentra archivos (si no, no prueba nada)", () => {
    assert.ok(archivos.length > 300, `solo ${archivos.length} archivos recorridos`);
  });

  test("REGRESIÓN: ningún import relativo apunta a un archivo que no existe", () => {
    assert.deepEqual(
      rotos, [],
      "estos imports no resuelven: al cargarlos, el navegador da 404 y la pantalla se queda en blanco"
    );
  });
}
