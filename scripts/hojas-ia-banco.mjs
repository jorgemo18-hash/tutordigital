#!/usr/bin/env node
// BANCO DE PRUEBAS DE LAS HOJAS CON IA: la misma hoja con varios modelos y
// modos, para decidir con datos y no con intuiciones qué modelo usar.
//
//   node scripts/hojas-ia-banco.mjs --modelos claude-sonnet-4-6,claude-sonnet-5-5 \
//        --modos directo,pensar --temas ecuaciones-primer-grado,proporcionalidad-y-porcentajes \
//        --curso 2 --cuantos 6 --salida /tmp/banco.json
//
// Por cada combinación: ejercicios que llegan, apartados que la IA resolvió
// mal (el servidor los quita), ejercicios tirados y por qué, tokens, coste y
// tiempo. En --salida deja las hojas enteras para leerlas: el verificador ve
// las cuentas, pero la calidad de un enunciado hay que leerla.
//
// REQUIERE ANTHROPIC_API_KEY (entorno o .env). GASTA DINERO: una o dos
// llamadas por combinación.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cargarEnv } from "./lib/cargarEnv.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const opcion = (nombre, porDefecto) => {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? porDefecto : process.argv[i + 1];
};
cargarEnv(resolve(RAIZ, ".env"));
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY (en el entorno o en .env).");
  process.exit(2);
}
const { createAnthropicClient } = await import("../server/lib/anthropic.js");
const { generaHojaIA } = await import("../server/lib/hojasIA/generaHojaIA.js");
const { computeCostUsd } = await import("../server/lib/aiPricing.js");

const lista = (t) => String(t).split(",").map((x) => x.trim()).filter(Boolean);
const modelos = lista(opcion("--modelos", "claude-sonnet-4-6"));
const modos = lista(opcion("--modos", "pensar"));
const temas = lista(opcion("--temas", "ecuaciones-primer-grado"));
const base = { etapa: opcion("--etapa", "eso"), materia: opcion("--materia", "matematicas"), curso: Number(opcion("--curso", "2")), cuantos: Number(opcion("--cuantos", "6")) };
const client = createAnthropicClient(process.env.ANTHROPIC_API_KEY);

const filas = [];
for (const tema of temas) {
  for (const model of modelos) {
    for (const modo of modos) {
      const inicio = process.hrtime.bigint();
      let r = null;
      let error = null;
      try {
        r = await generaHojaIA({ client, model, ...base, tema, pensar: modo === "pensar" });
      } catch (e) {
        error = e?.message || String(e);
      }
      const segundos = Number(process.hrtime.bigint() - inicio) / 1e9;
      const fila = { tema, model, modo, segundos: Math.round(segundos), error };
      if (r) {
        const apartadosBuenos = r.huecos.reduce((n, h) => n + Math.max(1, (h.comprobar || []).length), 0);
        fila.llegan = r.huecos.length;
        fila.comprobadas = r.huecos.filter((h) => h.verificacion === "comprobada").length;
        fila.apartadosQuitados = r.descartes.filter((d) => d.soloApartado).length;
        fila.tirados = r.descartes.filter((d) => !d.soloApartado).length;
        fila.motivos = r.descartes.map((d) => d.motivo);
        fila.apartadosLlegan = apartadosBuenos;
        fila.tokens = r.usage;
        fila.usd = computeCostUsd({ model, inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens });
        fila.hoja = r.hoja;
        fila.huecos = r.huecos;
      }
      filas.push(fila);
      const resumen = error
        ? `ERROR ${error}`
        : `llegan ${fila.llegan}/${base.cuantos} · apartados quitados ${fila.apartadosQuitados} · tirados ${fila.tirados} · ${fila.tokens.input_tokens}/${fila.tokens.output_tokens} tokens · ${fila.usd ?? "?"} USD`;
      console.log(`${tema.padEnd(32)} ${model.padEnd(18)} ${modo.padEnd(8)} ${String(fila.segundos).padStart(4)} s  ${resumen}`);
    }
  }
}
const salida = opcion("--salida", null);
if (salida) {
  writeFileSync(salida, JSON.stringify(filas, null, 1));
  console.log(`\nHojas enteras en ${salida}`);
}
const total = filas.reduce((s, f) => s + (f.usd || 0), 0);
console.log(`\nCoste total: ${total.toFixed(3)} USD`);
