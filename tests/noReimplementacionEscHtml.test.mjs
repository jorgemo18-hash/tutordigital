// Guarda de árbol completo, complementaria a la regla de eslint
// (no-restricted-syntax sobre eslint.config.js): esa regla solo atrapa una
// declaración CON NOMBRE (function escHtml/_esc/escapeHtml). No atrapa una
// reimplementación anónima — exactamente el patrón que tenían
// chatRenderer.js y chatStreamingBubble.js hasta hoy: una cadena de
// .replace()/.replaceAll() suelta, sin nombre de función, escapando & < >
// a mano. Este test recorre todo el árbol y falla si encuentra esa firma
// fuera del propio canónico.
//
// Heurística: un fichero que contiene, como literal de string, TANTO
// "&amp;" COMO "&lt;" casi seguro está reimplementando el escapado HTML a
// mano (es la firma de salida de cualquier escapador manual, sea con
// .replace o .replaceAll, regex o string plano) — verificado que hoy solo
// la cumple assets/shared/js/escHtml.js.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["assets", "server"];
const CANONICAL = "assets/shared/js/escHtml.js";
const SKIP_DIRS = new Set(["node_modules", "assets/shared/vendor"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = full.split("\\").join("/");
    if ([...SKIP_DIRS].some((skip) => rel === skip || rel.startsWith(skip + "/"))) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith(".js")) out.push(rel);
  }
  return out;
}

export async function run({ test, assert }) {
  test("ningún archivo fuera del canónico reimplementa el escapado HTML a mano (& y < juntos)", () => {
    const offenders = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        if (file === CANONICAL) continue;
        const src = readFileSync(file, "utf8");
        if (src.includes("&amp;") && src.includes("&lt;")) offenders.push(file);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Reimplementación local de escapado HTML detectada — importa escHtml desde ${CANONICAL}:\n` +
        offenders.map((f) => `  - ${f}`).join("\n")
    );
  });
}
