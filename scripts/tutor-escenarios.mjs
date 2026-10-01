#!/usr/bin/env node
// scripts/tutor-escenarios.mjs — cómo contesta el tutor, con la IA de verdad.
//
// POR QUÉ. Los tests de npm comprueban lo que DICE el prompt ("no des la
// respuesta", "una pregunta"…), pero no cómo CONTESTA la IA con ese prompt.
// Eso solo se sabe preguntándole. Este script pasa los escenarios fijos de
// scripts/lib/tutorEscenarios/escenarios.mjs por el mismo camino que usa la
// app (askAnthropicChat: prompt, historial, saneado y señales) y corrige:
//   - con reglas que un programa puede contar (no regala, una pregunta,
//     corta, marca el paso cuando toca…), y
//   - con un juez (Opus) que puntúa la rúbrica de LearnLM.
//
// No toca la base de datos ni ningún alumno. Gasta llamadas a la API: con
// los 14 escenarios × 3 veces son 42 respuestas del tutor + 42 del juez
// (del orden de 1 € con los precios de septiembre de 2026).
//
// USO:
//   node scripts/tutor-escenarios.mjs                  # todos, 3 veces cada uno
//   node scripts/tutor-escenarios.mjs --veces 1        # una pasada rápida
//   node scripts/tutor-escenarios.mjs --solo error-de-signo
//   node scripts/tutor-escenarios.mjs --sin-juez       # solo las reglas
//
// Deja el informe en informes/tutor-escenarios/ (fuera de git) y sale con
// error si alguna respuesta regala la solución o enseña una señal.
//
// REQUIERE en el entorno o en .env: ANTHROPIC_API_KEY. Usa ANTHROPIC_MODEL
// si está puesto (el mismo que el servidor), si no el de anthropic.js.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cargarEnv } from "./lib/cargarEnv.mjs";
import { ESCENARIOS } from "./lib/tutorEscenarios/escenarios.mjs";
import { ejecutarTodos } from "./lib/tutorEscenarios/ejecutar.mjs";
import { textoDelInforme, hayFallosGraves, avisoDelJuez } from "./lib/tutorEscenarios/informe.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function opcion(nombre) {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? null : process.argv[i + 1];
}

cargarEnv(resolve(RAIZ, ".env"));
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Falta ANTHROPIC_API_KEY (en el entorno o en .env).");
  process.exit(2);
}

// Se importan después de cargar el .env, por si algún módulo lee el entorno
// al cargarse.
const { askAnthropicChat } = await import("../server/lib/chat.js");
const { createAnthropicClient, TUTOR_MODEL, OPUS_MODEL } = await import("../server/lib/anthropic.js");

const modelo = process.env.ANTHROPIC_MODEL || TUTOR_MODEL;
const veces = Math.max(1, Number(opcion("--veces")) || 3);
const solo = opcion("--solo");
const conJuez = !process.argv.includes("--sin-juez");

const escenarios = solo ? ESCENARIOS.filter((e) => e.id === solo) : ESCENARIOS;
if (!escenarios.length) {
  console.error(`No hay ningún escenario "${solo}". Los que hay: ${ESCENARIOS.map((e) => e.id).join(", ")}`);
  process.exit(2);
}

const cliente = createAnthropicClient(apiKey);
async function preguntarAlJuez(prompt) {
  // Sin `temperature`: con este modelo la API la rechaza (400) y el juez no
  // valoraba nada (informe del 27/09/2026).
  const r = await cliente.messages.create({ model: OPUS_MODEL, max_tokens: 400, messages: [{ role: "user", content: prompt }] });
  return r.content.find((b) => b.type === "text")?.text || "";
}

console.log(`${escenarios.length} escenarios × ${veces} · tutor ${modelo}${conJuez ? ` · juez ${OPUS_MODEL}` : " · sin juez"}\n`);
// CUÁNTO TARDA Y SI LA CACHÉ ACIERTA (1/10/2026). Se pide por streaming, como
// la app, para medir lo que espera el alumno hasta ver la primera palabra.
const tiempos = [];
const cache = { leidos: 0, escritos: 0, sinCache: 0 };
async function tutorMedido(datos) {
  const inicio = Date.now();
  let primera = null;
  const r = await askAnthropicChat(datos, { apiKey, defaultModel: modelo, onChunk: () => { primera ??= Date.now() - inicio; } });
  tiempos.push({ primera: primera ?? Date.now() - inicio, total: Date.now() - inicio });
  const u = r?.data?.usage || {};
  cache.leidos += u.cache_read_input_tokens || 0;
  cache.escritos += u.cache_creation_input_tokens || 0;
  cache.sinCache += u.input_tokens || 0;
  return r;
}
const mediana = (xs) => { const o = [...xs].sort((a, b) => a - b); return o[Math.floor(o.length / 2)] ?? 0; };

const resultados = await ejecutarTodos(escenarios, {
  tutor: tutorMedido,
  preguntarAlJuez: conJuez ? preguntarAlJuez : null,
  veces,
}, (r) => console.log(`${r.bien === r.veces ? "✓" : "✗"} ${r.bien}/${r.veces}  ${r.que}`));

const ahora = new Date();
const fecha = ahora.toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 16);
const dir = resolve(RAIZ, "informes/tutor-escenarios");
mkdirSync(dir, { recursive: true });
const ruta = resolve(dir, `${fecha.replace(/[: ]/g, "-")}.md`);
for (const linea of avisoDelJuez(resultados)) if (linea) console.error(`\n${linea.replace(/^> /, "")}`);
writeFileSync(ruta, textoDelInforme(resultados, { fecha, modelo, modeloJuez: conJuez ? OPUS_MODEL : null }));
console.log(`\nInforme: ${ruta}`);
const seg = (ms) => (ms / 1000).toFixed(1).replace(".", ",");
console.log(`Primera palabra: mediana ${seg(mediana(tiempos.map((t) => t.primera)))} s, la más lenta ${seg(Math.max(0, ...tiempos.map((t) => t.primera)))} s · respuesta entera: mediana ${seg(mediana(tiempos.map((t) => t.total)))} s`);
console.log(`Tokens de entrada: ${cache.leidos} leídos de caché, ${cache.escritos} escritos en caché, ${cache.sinCache} sin caché`);

if (hayFallosGraves(resultados)) {
  console.error("\n⚠️  Alguna respuesta regala la solución o enseña una señal. Mira el informe.");
  process.exit(1);
}
