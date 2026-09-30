#!/usr/bin/env node
// PRUEBA REAL DE LAS HOJAS CON IA (server/lib/hojasIA/): escribe una hoja de
// un tema con la IA de verdad y enseña qué ha salido, qué se ha comprobado y
// qué se ha tirado. Sin servidor ni base de datos.
//
//   node scripts/hoja-ia-prueba.mjs                         (ecuaciones de 1.er grado, 2.º ESO)
//   node scripts/hoja-ia-prueba.mjs --tema funciones --cuantos 5
//
// REQUIERE en el entorno o en .env: ANTHROPIC_API_KEY. Gasta una llamada.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cargarEnv } from "./lib/cargarEnv.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const opcion = (nombre, porDefecto) => {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? porDefecto : process.argv[i + 1];
};

cargarEnv(resolve(RAIZ, ".env"));
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Falta ANTHROPIC_API_KEY (en el entorno o en .env).");
  process.exit(2);
}
const { createAnthropicClient, SONNET_MODEL } = await import("../server/lib/anthropic.js");
const { generaHojaIA } = await import("../server/lib/hojasIA/generaHojaIA.js");

const pedido = {
  etapa: opcion("--etapa", "eso"),
  materia: opcion("--materia", "matematicas"),
  curso: Number(opcion("--curso", "2")),
  tema: opcion("--tema", "ecuaciones-primer-grado"),
  cuantos: Number(opcion("--cuantos", "6")),
};
console.log(`Escribiendo ${pedido.cuantos} ejercicios de ${pedido.tema} (${pedido.materia}, ${pedido.curso}.º ${pedido.etapa})…\n`);
const r = await generaHojaIA({ client: createAnthropicClient(apiKey), model: process.env.ANTHROPIC_MODEL || SONNET_MODEL, ...pedido });
if (!r) {
  console.error("Ese tema no tiene ejercicios de referencia.");
  process.exit(2);
}
r.hoja.actividades.forEach((a, i) => {
  const h = r.huecos[i];
  console.log(`${h.orden}. [${h.verificacion === "comprobada" ? "COMPROBADA" : "SIN VERIFICAR"}] ${h.nombre} · ${h.saber.codigo} · dificultad ${h.dificultad}`);
  console.log(`   ${a.enunciado}`);
  for (const ap of a.apartados || []) console.log(`     - ${ap}`);
  console.log(`   Solución: ${h.solucion}\n`);
});
console.log(`Descartados por la comprobación: ${r.descartes.filter((d) => !d.soloApartado).length} ejercicios, ${r.descartes.filter((d) => d.soloApartado).length} apartados sueltos`);
for (const d of r.descartes) console.log(`  - ${d.motivo} :: ${d.enunciado}`);
console.log(`\nTokens: ${r.usage?.input_tokens ?? "?"} de entrada, ${r.usage?.output_tokens ?? "?"} de salida.`);
